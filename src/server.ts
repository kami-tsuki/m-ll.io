import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { tryAddScoreLimited, topScores, leaderboardMeta } from './db.js';
import { sanitizeName } from './filters.js';
import crypto from 'crypto';

// In-memory game sessions (ephemeral). For stronger security you'd persist or sign tokens.
interface GameSession { start: number; submitted: boolean; }
const sessions = new Map<string, GameSession>();
const SPAWN_MIN_MS = 1200; // must mirror engine min spawn interval
const MAX_SESSION_AGE_MS = 1000 * 60 * 60 * 2; // 2h cleanup threshold

function cleanupSessions(now: number) {
  for (const [id, s] of sessions) {
    if (now - s.start > MAX_SESSION_AGE_MS) sessions.delete(id);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({ logger: true });

fastify.register(fastifyStatic, {
  root: join(__dirname, '..', 'public'),
  prefix: '/',
});

fastify.get('/api/health', async () => ({ ok: true }));

// Start a play session; must be called BEFORE scoring to obtain sessionId
fastify.post('/api/session/start', async () => {
  const now = Date.now();
  cleanupSessions(now);
  const id = crypto.randomUUID();
  sessions.set(id, { start: now, submitted: false });
  return { sessionId: id, startedAt: now };
});

fastify.get('/api/leaderboard', async () => {
  const scores = topScores();
  return { scores, meta: leaderboardMeta() };
});

fastify.post('/api/leaderboard', async (req, reply) => {
  try {
    const body = req.body as any;
    const sessionId = (body?.sessionId || '').toString();
  let name = (body?.name || 'anon').toString().trim() || 'anon';
  name = sanitizeName(name);
    const score = Number(body?.score) || 0;
    const session = sessions.get(sessionId);
    const metaBefore = leaderboardMeta();
    if (!session) {
      return { ok: false, reason: 'invalid_session', meta: metaBefore };
    }
    if (session.submitted) {
      return { ok: false, reason: 'already_submitted', meta: metaBefore };
    }
    const elapsedMs = Date.now() - session.start;
    // Plausibility checks
    if (elapsedMs < 0) return { ok: false, reason: 'time_anomaly', meta: metaBefore };
    if (score % 10 !== 0) return { ok: false, reason: 'invalid_increment', meta: metaBefore };
    const maxPossibleItems = Math.floor(elapsedMs / SPAWN_MIN_MS) + 1; // optimistic upper bound
    const itemsClaimed = score / 10;
    if (itemsClaimed > maxPossibleItems * 1.1) { // allow 10% leniency for randomness
      return { ok: false, reason: 'implausible_score', meta: metaBefore, maxPossibleScore: maxPossibleItems * 10 };
    }
    const result = tryAddScoreLimited(name, score);
    if (result.accepted) session.submitted = true;
    return { ok: result.accepted, id: result.id, meta: leaderboardMeta(), minimumToBeat: result.minimumToBeat };
  } catch (e) {
    reply.code(400);
    return { ok: false };
  }
});

const port = Number(process.env.PORT) || 3000;
fastify.listen({ port, host: '0.0.0.0' }).catch(err => {
  fastify.log.error(err);
  process.exit(1);
});
