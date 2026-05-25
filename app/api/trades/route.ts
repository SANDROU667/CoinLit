import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getAuthorizedUser } from "@/lib/server/require-user";
import { hostedDatabaseMissingResponse, isHostedDatabaseMissing } from "@/lib/server/runtime";

type TradePayload = {
  date: string;
  pair: string;
  side: "long" | "short";
  entry: number;
  exit: number;
  stop: number;
  size: number;
  fee: number;
  note: string;
  pnl: number;
  riskAmount: number;
  rMultiple: number;
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const user = await getAuthorizedUser(request);
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const pool = getPool();
  if (!pool) {
    if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
    return NextResponse.json({ trades: [], source: "no-db" });
  }

  const [rows] = await pool.execute(
    `SELECT id, trade_date, pair_symbol, side, entry_price, exit_price, stop_price, position_size, fee, note, pnl, risk_amount, r_multiple
     FROM trades
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [user.id]
  );

  const trades = (
    rows as Array<{
      id: number;
      trade_date: string;
      pair_symbol: string;
      side: "long" | "short";
      entry_price: number | string;
      exit_price: number | string;
      stop_price: number | string;
      position_size: number | string;
      fee: number | string;
      note: string;
      pnl: number | string;
      risk_amount: number | string;
      r_multiple: number | string;
    }>
  ).map((row) => ({
    id: String(row.id),
    date: new Date(row.trade_date).toISOString().slice(0, 10),
    pair: row.pair_symbol,
    side: row.side,
    entry: toNumber(row.entry_price),
    exit: toNumber(row.exit_price),
    stop: toNumber(row.stop_price),
    size: toNumber(row.position_size),
    fee: toNumber(row.fee),
    note: row.note,
    pnl: toNumber(row.pnl),
    riskAmount: toNumber(row.risk_amount),
    rMultiple: toNumber(row.r_multiple)
  }));

  return NextResponse.json({ trades, source: "mysql" });
}

export async function POST(request: NextRequest) {
  const user = await getAuthorizedUser(request);
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const body = (await request.json()) as TradePayload;
  if (!body.date || !body.pair || !body.side) {
    return NextResponse.json({ error: "Некорректные данные сделки." }, { status: 400 });
  }

  const pool = getPool();
  if (!pool) {
    if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
    return NextResponse.json({ ok: true, fallback: true });
  }

  await pool.execute(
    `INSERT INTO trades
     (user_id, trade_date, pair_symbol, side, entry_price, exit_price, stop_price, position_size, fee, note, pnl, risk_amount, r_multiple)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      body.date,
      body.pair,
      body.side,
      toNumber(body.entry),
      toNumber(body.exit),
      toNumber(body.stop),
      toNumber(body.size),
      toNumber(body.fee),
      body.note?.slice(0, 500) ?? "",
      toNumber(body.pnl),
      toNumber(body.riskAmount),
      toNumber(body.rMultiple)
    ]
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthorizedUser(request);
  if (!user) return NextResponse.json({ error: "Требуется вход." }, { status: 401 });

  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id обязателен." }, { status: 400 });

  const pool = getPool();
  if (!pool) {
    if (isHostedDatabaseMissing()) return hostedDatabaseMissingResponse();
    return NextResponse.json({ ok: true, fallback: true });
  }

  await pool.execute("DELETE FROM trades WHERE id = ? AND user_id = ?", [id, user.id]);
  return NextResponse.json({ ok: true });
}
