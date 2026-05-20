import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const maxDuration = 15;

let _colsMigrated = false;
async function ensureCols() {
  if (_colsMigrated) return;
  const sql = getDb();
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMPTZ`.catch(() => {});
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS recovery_whatsapp_sent_at TIMESTAMPTZ`.catch(() => {});
  _colsMigrated = true;
}

// POST { telefone, stickerId? }           → registra abandono
// POST { telefone, _cancel: true }        → usuário voltou, cancela
// (sendBeacon só suporta POST, por isso o cancel também é POST)
export async function POST(req: NextRequest) {
  let body: { telefone?: string; stickerId?: string; _cancel?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const telefone = body.telefone?.replace(/\D/g, "").slice(0, 20);
  if (!telefone || telefone.length < 8) return NextResponse.json({ ok: false }, { status: 400 });

  await ensureCols();
  const sql = getDb();

  if (body._cancel) {
    await sql`
      UPDATE pedidos SET abandoned_at = NULL
      WHERE telefone = ${telefone}
        AND recovery_whatsapp_sent_at IS NULL
        AND abandoned_at IS NOT NULL
    `.catch(() => {});
    return NextResponse.json({ ok: true, action: "cancelled" });
  }

  await sql`
    UPDATE pedidos SET abandoned_at = NOW()
    WHERE telefone = ${telefone}
      AND sticker_url IS NOT NULL
      AND recovery_whatsapp_sent_at IS NULL
      ${body.stickerId ? sql`AND sticker_id = ${body.stickerId}` : sql``}
    ORDER BY created_at DESC LIMIT 1
  `.catch(() => {});

  console.log(`Abandono registrado — telefone=${telefone}`);
  return NextResponse.json({ ok: true, action: "recorded" });
}
