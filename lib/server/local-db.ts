import { promises as fs } from "fs";
import path from "path";

export type LocalUserRole = "user" | "admin";

export type LocalUserRecord = {
  id: number;
  email: string;
  login: string;
  passwordHash: string;
  dateOfBirth: string;
  role: LocalUserRole;
  coins: number;
  streak: number;
  blocked: boolean;
  createdAt: string;
  updatedAt: string;
};

type LocalDatabase = {
  version: 1;
  users: LocalUserRecord[];
  counters: {
    users: number;
  };
};

type NewLocalUser = {
  email: string;
  login: string;
  passwordHash: string;
  dateOfBirth: string;
  role?: LocalUserRole;
};

type UpdateLocalUserPatch = {
  email?: string;
  login?: string;
  passwordHash?: string;
  blocked?: boolean;
  coins?: number;
  streak?: number;
};

export type LocalUserPublic = Omit<LocalUserRecord, "passwordHash">;

const DB_PATH = process.env.LOCAL_DB_FILE
  ? path.resolve(process.env.LOCAL_DB_FILE)
  : path.join(process.cwd(), "data", "coinlit-local-db.json");

let writeQueue: Promise<void> = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeLogin(value: string) {
  return value.trim();
}

function toPublicUser(user: LocalUserRecord): LocalUserPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = user;
  return rest;
}

function createEmptyDb(): LocalDatabase {
  return {
    version: 1,
    users: [],
    counters: { users: 0 }
  };
}

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(createEmptyDb(), null, 2), "utf8");
  }
}

function sanitizeDb(raw: unknown): LocalDatabase {
  if (!raw || typeof raw !== "object") return createEmptyDb();
  const value = raw as Partial<LocalDatabase>;
  const users = Array.isArray(value.users) ? value.users : [];
  const countersUsers =
    typeof value.counters?.users === "number" && Number.isFinite(value.counters.users) && value.counters.users >= 0
      ? Math.floor(value.counters.users)
      : users.reduce((maxId, user) => Math.max(maxId, Number((user as { id?: number }).id) || 0), 0);

  return {
    version: 1,
    users: users
      .map((userLike) => {
        const user = userLike as Partial<LocalUserRecord>;
        const id = Number(user.id);
        if (!Number.isFinite(id) || id <= 0) return null;
        if (!user.email || !user.login || !user.passwordHash || !user.dateOfBirth) return null;
        return {
          id: Math.floor(id),
          email: normalizeEmail(String(user.email)),
          login: normalizeLogin(String(user.login)),
          passwordHash: String(user.passwordHash),
          dateOfBirth: String(user.dateOfBirth),
          role: user.role === "admin" ? "admin" : "user",
          coins: Number.isFinite(user.coins) ? Number(user.coins) : 0,
          streak: Number.isFinite(user.streak) ? Number(user.streak) : 0,
          blocked: Boolean(user.blocked),
          createdAt: String(user.createdAt ?? nowIso()),
          updatedAt: String(user.updatedAt ?? nowIso())
        } satisfies LocalUserRecord;
      })
      .filter((user): user is LocalUserRecord => Boolean(user)),
    counters: { users: countersUsers }
  };
}

async function readDb(): Promise<LocalDatabase> {
  await ensureDbFile();
  const content = await fs.readFile(DB_PATH, "utf8");
  try {
    const parsed = JSON.parse(content) as unknown;
    return sanitizeDb(parsed);
  } catch {
    const empty = createEmptyDb();
    await fs.writeFile(DB_PATH, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
}

async function writeDb(db: LocalDatabase) {
  await ensureDbFile();
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

async function withWriteLock<T>(task: () => Promise<T>) {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function cloneUser(user: LocalUserRecord): LocalUserRecord {
  return { ...user };
}

export async function findLocalUserByEmail(email: string): Promise<LocalUserRecord | null> {
  const normalized = normalizeEmail(email);
  const db = await readDb();
  const found = db.users.find((user) => user.email === normalized);
  return found ? cloneUser(found) : null;
}

export async function findLocalUserById(id: number): Promise<LocalUserRecord | null> {
  if (!Number.isFinite(id) || id <= 0) return null;
  const db = await readDb();
  const found = db.users.find((user) => user.id === id);
  return found ? cloneUser(found) : null;
}

export async function createLocalUser(payload: NewLocalUser): Promise<{ ok: true; user: LocalUserRecord } | { ok: false; reason: "email_exists" | "login_exists" }> {
  return withWriteLock(async () => {
    const db = await readDb();
    const email = normalizeEmail(payload.email);
    const login = normalizeLogin(payload.login);

    if (db.users.some((user) => user.email === email)) {
      return { ok: false, reason: "email_exists" as const };
    }
    if (db.users.some((user) => user.login.toLowerCase() === login.toLowerCase())) {
      return { ok: false, reason: "login_exists" as const };
    }

    const id = db.counters.users + 1;
    const timestamp = nowIso();
    const user: LocalUserRecord = {
      id,
      email,
      login,
      passwordHash: payload.passwordHash,
      dateOfBirth: payload.dateOfBirth,
      role: payload.role ?? "user",
      coins: 0,
      streak: 0,
      blocked: false,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    db.users.push(user);
    db.counters.users = id;
    await writeDb(db);
    return { ok: true as const, user: cloneUser(user) };
  });
}

export async function updateLocalUser(
  userId: number,
  patch: UpdateLocalUserPatch
): Promise<{ ok: true; user: LocalUserRecord } | { ok: false; reason: "not_found" | "email_exists" | "login_exists" }> {
  return withWriteLock(async () => {
    const db = await readDb();
    const index = db.users.findIndex((item) => item.id === userId);
    if (index === -1) return { ok: false as const, reason: "not_found" as const };

    const current = db.users[index];
    const email = typeof patch.email === "string" ? normalizeEmail(patch.email) : current.email;
    const login = typeof patch.login === "string" ? normalizeLogin(patch.login) : current.login;

    const duplicateEmail = db.users.find((item) => item.id !== current.id && item.email === email);
    if (duplicateEmail) return { ok: false as const, reason: "email_exists" as const };

    const duplicateLogin = db.users.find((item) => item.id !== current.id && item.login.toLowerCase() === login.toLowerCase());
    if (duplicateLogin) return { ok: false as const, reason: "login_exists" as const };

    const updated: LocalUserRecord = {
      ...current,
      email,
      login,
      passwordHash: patch.passwordHash ?? current.passwordHash,
      blocked: typeof patch.blocked === "boolean" ? patch.blocked : current.blocked,
      coins: Number.isFinite(patch.coins) ? Number(patch.coins) : current.coins,
      streak: Number.isFinite(patch.streak) ? Number(patch.streak) : current.streak,
      updatedAt: nowIso()
    };

    db.users[index] = updated;
    await writeDb(db);
    return { ok: true as const, user: cloneUser(updated) };
  });
}

export async function listLocalUsers(query?: string): Promise<LocalUserPublic[]> {
  const db = await readDb();
  const normalizedQuery = query ? query.trim().toLowerCase() : "";
  const rows = db.users
    .filter((user) => {
      if (!normalizedQuery) return true;
      return (
        user.email.toLowerCase().includes(normalizedQuery) ||
        user.login.toLowerCase().includes(normalizedQuery) ||
        String(user.id).includes(normalizedQuery)
      );
    })
    .sort((a, b) => b.id - a.id)
    .map((user) => toPublicUser(user));
  return rows;
}

export async function updateLocalUserBlocked(
  userId: number,
  blocked: boolean
): Promise<{ ok: true; user: LocalUserPublic } | { ok: false; reason: "not_found" }> {
  const result = await updateLocalUser(userId, { blocked });
  if (!result.ok) return { ok: false, reason: "not_found" };
  return { ok: true, user: toPublicUser(result.user) };
}

export function asPublicUser(user: LocalUserRecord): LocalUserPublic {
  return toPublicUser(user);
}

export function getLocalDbPath() {
  return DB_PATH;
}
