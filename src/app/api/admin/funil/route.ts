import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function periodToInterval(period: string): string | null {
  const hourMatch = period.match(/^(\d+)h$/);
  if (hourMatch) return `${hourMatch[1]} hours`;
  if (period === "today") return "24 hours";
  if (period === "7d")    return "7 days";
  if (period === "30d")   return "30 days";
  return null;
}

export async function GET(req: NextRequest) {
  const sql = getDb();
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "all";
  const interval = periodToInterval(period);

  // Usar cast ::interval para que o parâmetro seja aceito pelo PostgreSQL
  const pfSession = interval
    ? sql`AND s.updated_at >= NOW() - ${interval}::interval`
    : sql``;

  const pfSimple = interval
    ? sql`AND updated_at >= NOW() - ${interval}::interval`
    : sql``;

  const [funnel, leads, pagos, obrigados, daily] = await Promise.all([
    sql`
      SELECT step, COUNT(*)::int as count
      FROM sessions
      WHERE email IS NOT NULL ${pfSimple}
      GROUP BY step
      ORDER BY count DESC
    `,
    sql`
      SELECT s.session_id, s.email, s.nome, s.step,
             to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at,
             COALESCE(s.cta_clicked, FALSE) as cta_clicked,
             COALESCE(s.obrigado, FALSE) as obrigado,
             COALESCE(p.telefone, s.email) as telefone
      FROM sessions s
      LEFT JOIN LATERAL (
        SELECT telefone FROM pedidos
        WHERE (telefone = s.email OR email = s.email) AND telefone IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
      ) p ON true
      WHERE s.email IS NOT NULL ${pfSession}
      ORDER BY s.updated_at DESC
      LIMIT 1000
    `,
    sql`
      SELECT COUNT(*)::int as count
      FROM pedidos
      WHERE status IN ('pago','entregue','recuperado') ${pfSimple}
    `,
    sql`
      SELECT s.session_id, s.email, s.nome,
             to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at,
             COALESCE(p.telefone, s.email) as telefone
      FROM sessions s
      LEFT JOIN LATERAL (
        SELECT telefone FROM pedidos
        WHERE (telefone = s.email OR email = s.email) AND telefone IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
      ) p ON true
      WHERE s.obrigado = TRUE ${pfSession}
      ORDER BY s.updated_at DESC
      LIMIT 500
    `,
    sql`
      SELECT updated_at::date as day, COUNT(DISTINCT session_id)::int as count
      FROM sessions
      WHERE email IS NOT NULL AND updated_at >= NOW() - '14 days'::interval
      GROUP BY day
      ORDER BY day
    `,
  ]);

  return NextResponse.json({ funnel, leads, pagos: pagos[0].count, obrigados, daily });
}
