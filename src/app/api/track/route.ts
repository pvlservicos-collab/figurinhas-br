import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, step, email, nome } = body;
    if (!session_id || !step) return new NextResponse(null, { status: 204 });

    const sql = getDb();
    await sql`
      INSERT INTO sessions (session_id, step, email, nome, updated_at)
      VALUES (${session_id}, ${step}, ${email || null}, ${nome || null}, NOW())
      ON CONFLICT (session_id) DO UPDATE SET
        step = EXCLUDED.step,
        email = COALESCE(EXCLUDED.email, sessions.email),
        nome = COALESCE(EXCLUDED.nome, sessions.nome),
        updated_at = NOW()
    `;
  } catch {
    // silencioso — não pode travar o usuário
  }
  return new NextResponse(null, { status: 204 });
}
