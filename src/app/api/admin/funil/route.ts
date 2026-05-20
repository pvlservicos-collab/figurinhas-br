import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function periodToCutoff(period: string): Date | null {
  const now = Date.now();
  const hourMatch = period.match(/^(\d+)h$/);
  if (hourMatch) return new Date(now - parseInt(hourMatch[1]) * 3600_000);
  if (period === "today") return new Date(now - 24 * 3600_000);
  if (period === "7d")    return new Date(now - 7  * 86400_000);
  if (period === "30d")   return new Date(now - 30 * 86400_000);
  return null;
}

export async function GET(req: NextRequest) {
  const sql = getDb();
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "all";
  const cutoff = periodToCutoff(period);

  const pfSession = cutoff ? sql`AND s.updated_at >= ${cutoff}` : sql``;
  const pfSimple  = cutoff ? sql`AND updated_at >= ${cutoff}`   : sql``;

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
      WHERE email IS NOT NULL AND updated_at >= NOW() - INTERVAL '14 days'
      GROUP BY day
      ORDER BY day
    `,
  ]);

  return NextResponse.json({ funnel, leads, pagos: pagos[0].count, obrigados, daily });
}
