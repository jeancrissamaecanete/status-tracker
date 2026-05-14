import { NextResponse } from 'next/server';
import { upsertAgent } from '@/lib/kv';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init.headers || {}) },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req) {
  const expected = process.env.SQUAD_WRITE_TOKEN;
  if (!expected) {
    return json({ error: 'server missing SQUAD_WRITE_TOKEN' }, { status: 500 });
  }
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (token !== expected) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const { squadId, agent } = body || {};
  if (typeof squadId !== 'string' || !squadId) {
    return json({ error: 'squadId required' }, { status: 400 });
  }
  if (!agent || typeof agent.id !== 'string' || !agent.id) {
    return json({ error: 'agent.id required' }, { status: 400 });
  }

  const safeAgent = {
    id: agent.id,
    name: typeof agent.name === 'string' ? agent.name : agent.id,
    status: typeof agent.status === 'string' ? agent.status : 'Offline',
    since: typeof agent.since === 'number' ? agent.since : null,
    history: Array.isArray(agent.history) ? agent.history.slice(0, 50) : [],
    longCallUpdates: Array.isArray(agent.longCallUpdates) ? agent.longCallUpdates.slice(0, 20) : [],
    breakTotals: agent.breakTotals && typeof agent.breakTotals === 'object' ? agent.breakTotals : {},
  };

  const squad = await upsertAgent(squadId, safeAgent);
  return json({ ok: true, lastUpdated: squad.lastUpdated });
}
