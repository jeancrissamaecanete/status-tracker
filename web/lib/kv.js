import { Redis } from '@upstash/redis';

const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  throw new Error(
    'Missing Upstash Redis env vars. Expected UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN.'
  );
}

const redis = new Redis({ url, token });
const SQUAD_TTL_SECONDS = 60 * 60 * 24 * 7;

function squadKey(squadId) {
  return `squad:${squadId}`;
}

export async function getSquad(squadId) {
  const data = await redis.get(squadKey(squadId));
  return data || { agents: [], lastUpdated: null };
}

export async function upsertAgent(squadId, agent) {
  const squad = await getSquad(squadId);
  const idx = squad.agents.findIndex((a) => a.id === agent.id);
  const now = Date.now();
  const merged = { ...agent, updatedAt: now };
  if (idx >= 0) squad.agents[idx] = merged;
  else squad.agents.push(merged);
  squad.lastUpdated = now;
  await redis.set(squadKey(squadId), squad, { ex: SQUAD_TTL_SECONDS });
  return squad;
}
