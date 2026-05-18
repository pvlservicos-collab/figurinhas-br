import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const sql = getDb();
  const logs = await sql`SELECT id, payload, created_at FROM webhook_logs ORDER BY id DESC LIMIT 20`;
  return NextResponse.json({ logs });
}
