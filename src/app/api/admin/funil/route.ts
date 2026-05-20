import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function periodToInterval(period: string): string | null {
  const hourMatch = period.match(/^(\d+)h$/);
  if (hourMatch) return `${hourMatch[1]} hours`;
  if (period === "today") return "1 day";   // aproximado; cobre últimas 24h
  if (period === "7d")    return "7 days";
  if (period === "30d")   return "30 days";
  return null; // "all" — sem filtro
}

export async function GET(req: NextRequest) {
  const sql = getDb();
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "all";

  // "today" usa meia-noite local; os demais usam intervalo relativo
  const useToday = period === "today";
  const interval = periodToInterval(period);

  // Fragmentos SQL reutilizáveis
  const pfSession = interval
    ? useToday
      ? sql`AND s.updated_at >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date`
      : sql`AND s.updated_at >= NOW() - INTERVAL ${interval}`
    : sql``;

  const pfSimple = interval
    ? useToday
      ? sql`AND updated_at >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date`
      : sql`AND updated_at >= NOW() - INTERVAL ${interval}`
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
      FROM pedidos WHERE status IN ('pago','entregue','recuperado')
      ${pfSimple}
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
