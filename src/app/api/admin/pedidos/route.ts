import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sql = getDb();
  const { searchParams } = new URL(req.url);
  const offset = Number(searchParams.get("offset") || "0");
  const limit = Number(searchParams.get("limit") || "100");
  const search = searchParams.get("search") || "";

  let pedidos;
  let totalFiltered;

  if (search.trim()) {
    const searchPattern = `%${search.trim()}%`;
    pedidos = await sql`
      SELECT p.id, p.nome, p.clube, p.jogador_favorito, p.sticker_url, p.sticker_id, p.status, p.email, p.telefone, p.pdf_url,
        COALESCE(p.whats_enviado, FALSE) as whats_enviado,
        CASE WHEN p.status IN ('pago', 'entregue', 'recuperado') AND COALESCE(p.whats_enviado, FALSE) = FALSE AND EXISTS (
          SELECT 1 FROM pedido_items pi
          WHERE pi.email = p.email AND pi.item_type = 'order_bump'
          AND pi.product_name LIKE '%What%'
        ) THEN TRUE ELSE FALSE END as whats_pendente,
        p.created_at, p.paid_at, p.delivered_at
      FROM pedidos p
      WHERE p.status IN ('pago','entregue','recuperado') AND (p.nome ILIKE ${searchPattern} OR p.email ILIKE ${searchPattern} OR p.clube ILIKE ${searchPattern} OR p.telefone ILIKE ${searchPattern})
      ORDER BY p.id DESC LIMIT ${limit} OFFSET ${offset}
    `;
    const countResult = await sql`
      SELECT COUNT(*)::int as total FROM pedidos
      WHERE status IN ('pago','entregue','recuperado') AND (nome ILIKE ${searchPattern} OR email ILIKE ${searchPattern} OR clube ILIKE ${searchPattern} OR telefone ILIKE ${searchPattern})
    `;
    totalFiltered = countResult[0].total;
  } else {
    pedidos = await sql`
      SELECT p.id, p.nome, p.clube, p.jogador_favorito, p.sticker_url, p.sticker_id, p.status, p.email, p.telefone, p.pdf_url,
        COALESCE(p.whats_enviado, FALSE) as whats_enviado,
        CASE WHEN p.status IN ('pago', 'entregue', 'recuperado') AND COALESCE(p.whats_enviado, FALSE) = FALSE AND EXISTS (
          SELECT 1 FROM pedido_items pi
          WHERE pi.email = p.email AND pi.item_type = 'order_bump'
          AND pi.product_name LIKE '%What%'
        ) THEN TRUE ELSE FALSE END as whats_pendente,
        p.created_at, p.paid_at, p.delivered_at
      FROM pedidos p
      WHERE p.status IN ('pago', 'entregue', 'recuperado')
      ORDER BY p.id DESC LIMIT ${limit} OFFSET ${offset}
    `;
    const countResult = await sql`SELECT COUNT(*)::int as total FROM pedidos WHERE status IN ('pago','entregue','recuperado')`;
    totalFiltered = countResult[0].total;
  }

  const statsResult = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('pago', 'entregue', 'recuperado'))::int AS total,
      COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendentes,
      COUNT(*) FILTER (WHERE status IN ('pago', 'entregue', 'recuperado'))::int AS pagos,
      COUNT(*) FILTER (WHERE status = 'entregue')::int AS entregues
    FROM pedidos
  `;

  return NextResponse.json({
    pedidos,
    stats: statsResult[0],
    totalFiltered,
    offset,
    limit,
    hasMore: offset + pedidos.length < totalFiltered,
  });
}

export async function DELETE(req: NextRequest) {
  const sql = getDb();
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (email === "all") {
    await sql`DELETE FROM pedidos`;
    return NextResponse.json({ ok: true, message: "Todos os pedidos removidos" });
  }

  if (email) {
    await sql`DELETE FROM pedidos WHERE email = ${email}`;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Parâmetro email obrigatório" }, { status: 400 });
}
