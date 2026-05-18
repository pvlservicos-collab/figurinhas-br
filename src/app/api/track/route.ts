import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, step, email, nome } = body;
    if (!session_id || !step) return new NextResponse(null, { status: 204 });

    const sql = getDb();
    const isCta = step === "checkout";
    const isObrigado = step === "obrigado";

    await sql`
      INSERT INTO sessions (session_id, step, email, nome, cta_clicked, obrigado, updated_at)
      VALUES (
        ${session_id}, ${step}, ${email || null}, ${nome || null},
        ${isCta}, ${isObrigado}, NOW()
      )
      ON CONFLICT (session_id) DO UPDATE SET
        step = EXCLUDED.step,
        email = COALESCE(EXCLUDED.email, sessions.email),
        nome = COALESCE(EXCLUDED.nome, sessions.nome),
        cta_clicked = sessions.cta_clicked OR ${isCta},
        obrigado = sessions.obrigado OR ${isObrigado},
        updated_at = NOW()
    `;
  } catch {
    // silencioso
  }
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(req: NextRequest) {
  try {
    const { session_id } = await req.json();
    if (!session_id) return new NextResponse(null, { status: 204 });
    const sql = getDb();
    await sql`DELETE FROM sessions WHERE session_id = ${session_id}`;
  } catch { /* ignora */ }
  return new NextResponse(null, { status: 204 });
}
