import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const sql = getDb();
  let rows: Record<string, string>[] = [];
  try {
    rows = await sql`
      SELECT sticker_url FROM pedidos
      WHERE sticker_id = ${id}
      LIMIT 1
    `;
  } catch {
    return NextResponse.json({ error: "Erro no banco" }, { status: 500 });
  }

  if (rows.length === 0 || !rows[0].sticker_url) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ url: rows[0].sticker_url });
}
