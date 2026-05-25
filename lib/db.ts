import { Pool } from "pg";

export type DbQueryMeta = {
  affectedRows: number;
  insertId?: number;
};

export type DbPool = {
  execute<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params?: unknown[]): Promise<[T[], DbQueryMeta]>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params?: unknown[]): Promise<[T[], DbQueryMeta]>;
};

declare global {
  // eslint-disable-next-line no-var
  var coinlitPool: DbPool | undefined;
  // eslint-disable-next-line no-var
  var coinlitSchemaReady: boolean | undefined;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    login VARCHAR(60) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    coins INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(80) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    level VARCHAR(40) NOT NULL,
    direction VARCHAR(120) NOT NULL,
    price VARCHAR(40) NOT NULL,
    hours INTEGER NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE
  )`,
  `CREATE TABLE IF NOT EXISTS course_blueprints (
    slug VARCHAR(80) PRIMARY KEY REFERENCES courses(slug) ON DELETE CASCADE,
    description TEXT NOT NULL,
    required_coins INTEGER NOT NULL DEFAULT 0,
    lessons_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS lessons (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    position INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tests (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id),
    title VARCHAR(255) NOT NULL,
    questions JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    code VARCHAR(80) NOT NULL,
    title VARCHAR(160) NOT NULL,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, code)
  )`,
  `CREATE TABLE IF NOT EXISTS lesson_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    course_id VARCHAR(80) NOT NULL,
    course_title VARCHAR(255) NOT NULL,
    lesson_id VARCHAR(120) NOT NULL,
    lesson_title VARCHAR(255) NOT NULL,
    test_correct BOOLEAN NOT NULL DEFAULT FALSE,
    coins INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, lesson_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lesson_progress_course ON lesson_progress(course_id)`,
  `CREATE TABLE IF NOT EXISTS test_results (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_test_results_user ON test_results(user_id)`,
  `CREATE TABLE IF NOT EXISTS trades (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    trade_date DATE NOT NULL,
    pair_symbol VARCHAR(40) NOT NULL,
    side VARCHAR(8) NOT NULL CHECK (side IN ('long', 'short')),
    entry_price NUMERIC(18, 8) NOT NULL,
    exit_price NUMERIC(18, 8) NOT NULL,
    stop_price NUMERIC(18, 8) NOT NULL,
    position_size NUMERIC(20, 8) NOT NULL,
    fee NUMERIC(18, 8) NOT NULL DEFAULT 0,
    note VARCHAR(500) NOT NULL DEFAULT '',
    pnl NUMERIC(18, 8) NOT NULL,
    risk_amount NUMERIC(18, 8) NOT NULL,
    r_multiple NUMERIC(12, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id)`
];

function toPostgresQuery(text: string) {
  let index = 0;
  return text.replace(/\?/g, () => `$${++index}`);
}

function createPoolAdapter(pool: Pool): DbPool {
  async function run<T extends Record<string, unknown>>(text: string, params: unknown[] = []): Promise<[T[], DbQueryMeta]> {
    const result = await pool.query<T>(toPostgresQuery(text), params);
    const firstRow = result.rows[0] as Record<string, unknown> | undefined;
    const insertIdCandidate = firstRow?.id;
    const insertId = typeof insertIdCandidate === "number" ? insertIdCandidate : Number(insertIdCandidate);

    return [
      result.rows,
      {
        affectedRows: result.rowCount ?? 0,
        insertId: Number.isFinite(insertId) ? insertId : undefined
      }
    ];
  }

  return {
    execute: run,
    query: run
  };
}

export function getDatabaseUrl() {
  return process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? null;
}

export function getPool() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) return null;
  if (!global.coinlitPool) {
    const rawPool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false }
    });
    global.coinlitPool = createPoolAdapter(rawPool);
  }
  return global.coinlitPool;
}

export async function ensureSchema(pool: DbPool) {
  if (global.coinlitSchemaReady) return;
  for (const statement of schemaStatements) {
    await pool.execute(statement);
  }
  global.coinlitSchemaReady = true;
}
