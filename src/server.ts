import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { addScore, topScores } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({ logger: true });

fastify.register(fastifyStatic, {
  root: join(__dirname, '..', 'public'),
  prefix: '/',
});

fastify.get('/api/health', async () => ({ ok: true }));

fastify.get('/api/leaderboard', async (req, reply) => {
  const scores = topScores(20);
  return { scores };
});

fastify.post('/api/leaderboard', async (req, reply) => {
  try {
    const body = req.body as any;
    const name = (body?.name || 'anon').toString().trim() || 'anon';
    const score = Number(body?.score) || 0;
  let id: number | undefined;
  if (score > 0) id = addScore(name, score);
  return { ok: true, id };
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
