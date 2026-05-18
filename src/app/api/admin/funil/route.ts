import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const sql = getDb();

  const [funnel, leads, pagos, obrigados] = await Promise.all([
    sql`
      SELECT step, COUNT(*)::int as count
      FROM sessions
      GROUP BY step
      ORDER BY count DESC
    `,
    sql`
      SELECT s.session_id, s.email, s.nome, s.step, s.updated_at,
             COALESCE(s.cta_clicked, FALSE) as cta_clicked,
             COALESCE(s.obrigado, FALSE) as obrigado,
             p.telefone
      FROM sessions s
      LEFT JOIN LATERAL (
        SELECT telefone FROM pedidos
        WHERE email = s.email AND telefone IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
      ) p ON true
      WHERE s.email IS NOT NULL
      ORDER BY s.updated_at DESC
      LIMIT 1000
    `,
    sql`
      SELECT COUNT(*)::int as count FROM pedidos WHERE status IN ('pago','entregue','recuperado')
    `,
    sql`
      SELECT s.session_id, s.email, s.nome, s.updated_at, p.telefone
      FROM sessions s
      LEFT JOIN LATERAL (
        SELECT telefone FROM pedidos
        WHERE email = s.email AND telefone IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
      ) p ON true
      WHERE s.obrigado = TRUE
      ORDER BY s.updated_at DESC
      LIMIT 500
    `,
  ]);

  return NextResponse.json({ funnel, leads, pagos: pagos[0].count, obrigados });
}
