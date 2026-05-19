import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sql = getDb();
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "all";

  let cutoff: Date | null = null;
  const now = new Date();
  if (period === "today") {
    cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === "7d") {
    const d = new Date(now); d.setDate(d.getDate() - 7); cutoff = d;
  } else if (period === "30d") {
    const d = new Date(now); d.setDate(d.getDate() - 30); cutoff = d;
  }

  const pf  = cutoff ? sql`AND s.updated_at >= ${cutoff}` : sql``;
  const pf2 = cutoff ? sql`AND updated_at >= ${cutoff}`   : sql``;

  const [funnel, leads, pagos, obrigados, daily] = await Promise.all([
    sql`
      SELECT step, COUNT(*)::int as count
      FROM sessions
      WHERE email IS NOT NULL ${pf2}
      GROUP BY step
      ORDER BY count DESC
    `,
    sql`
      SELECT s.session_id, s.email, s.nome, s.step,
             to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at,
             COALESCE(s.cta_clicked, FALSE) as cta_clicked,
             COALESCE(s.obrigado, FALSE) as obrigado,
             p.telefone
      FROM sessions s
      LEFT JOIN LATERAL (
        SELECT telefone FROM pedidos
        WHERE email = s.email AND telefone IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
      ) p ON true
      WHERE s.email IS NOT NULL ${pf}
      ORDER BY s.updated_at DESC
      LIMIT 1000
    `,
    sql`
      SELECT COUNT(*)::int as count
      FROM pedidos WHERE status IN ('pago','entregue','recuperado')
    `,
    sql`
      SELECT s.session_id, s.email, s.nome,
             to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at,
             p.telefone
      FROM sessions s
      LEFT JOIN LATERAL (
        SELECT telefone FROM pedidos
        WHERE email = s.email AND telefone IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
      ) p ON true
      WHERE s.obrigado = TRUE ${pf}
      ORDER BY s.updated_at DESC
      LIMIT 500
    `,
    sql`
      SELECT updated_at::date as day, COUNT(DISTINCT session_id)::int as count
      FROM sessions
      WHERE email IS NOT NULL AND updated_at >= NOW() - INTERVAL '14 days'
      GROUP BY day
      ORDER BY day
    `,
  ]);

  return NextResponse.json({ funnel, leads, pagos: pagos[0].count, obrigados, daily });
}
