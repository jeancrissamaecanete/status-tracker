import { kv } from '@vercel/kv';

const SQUAD_TTL_SECONDS = 60 * 60 * 24 * 7;

function squadKey(squadId) {
  return `squad:${squadId}`;
}

export async function getSquad(squadId) {
  const data = await kv.get(squadKey(squadId));
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
  await kv.set(squadKey(squadId), squad, { ex: SQUAD_TTL_SECONDS });
  return squad;
}
