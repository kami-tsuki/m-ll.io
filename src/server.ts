import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { tryAddScoreLimited, topScores, leaderboardMeta } from './db.js';
import { sanitizeName } from './filters.js';
import crypto from 'crypto';
import { CONFIG, SECURITY, minSpawnInterval } from './constants.js';

// Stateless signed sessions (HMAC over start timestamp)
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
function signSession(start: number) {
  const payload = `${start}`;
  const sig = crypto.createHmac(SECURITY.SESSION_HMAC_ALGO, SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}
function verifySession(token: string): { start: number } | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const [payload, sig] = raw.split('.') as [string, string];
    if (!payload || !sig) return null;
    const expected = crypto.createHmac(SECURITY.SESSION_HMAC_ALGO, SESSION_SECRET).update(payload).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      const start = Number(payload);
      if (Number.isFinite(start) && Date.now() - start < SECURITY.SESSION_TTL_MS) return { start };
    }
    return null;
  } catch { return null; }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({ logger: true, bodyLimit: 32 * 1024 });

fastify.register(helmet, { contentSecurityPolicy: {
  useDefaults: true,
  directives: { 'script-src': ["'self'"], 'object-src': ["'none'"], 'base-uri': ["'self'"] }
}});
fastify.register(rateLimit, { max: 60, timeWindow: '1 minute' });
fastify.register(fastifyStatic, {
  root: join(__dirname, '..', 'public'),
  prefix: '/',
  cacheControl: true,
  etag: true,
  maxAge: '1h',
});

// Simple in-memory metrics
const metrics = { sessionsStarted: 0, scoresAccepted: 0, scoresRejected: 0 };

fastify.get('/api/health', async () => ({ ok: true, uptime: process.uptime() }));

fastify.get('/api/config', async () => ({
  bins: CONFIG.BIN_CAPACITY,
  spawnInterval: CONFIG.SPAWN_INTERVAL_MS,
  truckInterval: CONFIG.TRUCK_INTERVAL_MS,
  inspectionInterval: CONFIG.INSPECTION_INTERVAL_MS,
  maxSpawnQueue: CONFIG.MAX_SPAWN_QUEUE,
  leaderboardLimit: CONFIG.LEADERBOARD_LIMIT,
  scorePerItem: CONFIG.SCORE_PER_ITEM,
}));

fastify.get('/api/metrics', async () => metrics);

// Start a play session; must be called BEFORE scoring to obtain sessionId
fastify.post('/api/session/start', async () => {
  const now = Date.now();
  metrics.sessionsStarted++;
  return { sessionId: signSession(now), startedAt: now };
});

fastify.get('/api/leaderboard', async () => {
  const scores = topScores();
  return { scores, meta: leaderboardMeta() };
});

interface LeaderboardPostBody { sessionId?: string; name?: string; score?: number }
fastify.post('/api/leaderboard', async (req, reply) => {
  try {
    const body = req.body as LeaderboardPostBody || {};
    const sessionId = (body.sessionId || '').toString();
  let name = (body.name || 'anon').toString().trim() || 'anon';
  name = sanitizeName(name);
    const score = Number(body.score) || 0;
  const valid = verifySession(sessionId);
    const metaBefore = leaderboardMeta();
  if (!valid) {
      return { ok: false, reason: 'invalid_session', meta: metaBefore };
    }
  const elapsedMs = Date.now() - valid.start;
    // Plausibility checks
    if (elapsedMs < 0) return { ok: false, reason: 'time_anomaly', meta: metaBefore };
    if (score % CONFIG.SCORE_PER_ITEM !== 0) return { ok: false, reason: 'invalid_increment', meta: metaBefore };
    const maxPossibleItems = Math.floor(elapsedMs / minSpawnInterval()) + 1; // optimistic upper bound
    const itemsClaimed = score / CONFIG.SCORE_PER_ITEM;
    if (itemsClaimed > maxPossibleItems * 1.1) { // allow 10% leniency for randomness
      metrics.scoresRejected++;
      return { ok: false, reason: 'implausible_score', meta: metaBefore, maxPossibleScore: maxPossibleItems * CONFIG.SCORE_PER_ITEM };
    }
    const result = tryAddScoreLimited(name, score);
    if (result.accepted) metrics.scoresAccepted++; else metrics.scoresRejected++;
    return { ok: result.accepted, id: result.id, meta: leaderboardMeta(), minimumToBeat: result.minimumToBeat };
  } catch (e) {
    reply.code(400);
    metrics.scoresRejected++;
    return { ok: false };
  }
});

const port = Number(process.env.PORT) || 3000;
fastify.listen({ port, host: '0.0.0.0' }).catch(err => {
  fastify.log.error(err);
  process.exit(1);
});
