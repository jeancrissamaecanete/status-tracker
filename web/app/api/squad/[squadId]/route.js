import { NextResponse } from 'next/server';
import { getSquad } from '@/lib/kv';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(_req, { params }) {
  const squadId = params?.squadId;
  if (typeof squadId !== 'string' || !squadId) {
    return NextResponse.json({ error: 'squadId required' }, { status: 400, headers: CORS_HEADERS });
  }
  const squad = await getSquad(squadId);
  return NextResponse.json(squad, { headers: CORS_HEADERS });
}
