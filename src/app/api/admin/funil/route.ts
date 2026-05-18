import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const sql = getDb();

  const [funnel, leads, pagos] = await Promise.all([
    sql`
      SELECT step, COUNT(*)::int as count
      FROM sessions
      GROUP BY step
      ORDER BY count DESC
    `,
    sql`
      SELECT session_id, email, nome, step, updated_at
      FROM sessions
      WHERE email IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 500
    `,
    sql`
      SELECT COUNT(*)::int as count FROM pedidos WHERE status IN ('pago','entregue','recuperado')
    `,
  ]);

  return NextResponse.json({ funnel, leads, pagos: pagos[0].count });
}
