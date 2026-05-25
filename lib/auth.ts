import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const secret = process.env.JWT_SECRET ?? "coinlit-dev-secret-change-me";

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

export type SessionUser = {
  id: number;
  email: string;
  login: string;
  role: "user" | "admin";
};

export function signToken(payload: SessionUser, maxAgeSeconds = 60 * 60 * 24 * 7) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds }));
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token?: string): SessionUser | null {
  if (!token) return null;
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) return null;
  const expected = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionUser & { exp: number };
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return { id: payload.id, email: payload.email, login: payload.login, role: payload.role };
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return timingSafeEqual(Buffer.from(hash), Buffer.from(next));
}

export function isAdult(dateOfBirth: string) {
  const birth = new Date(dateOfBirth);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear();
  const hadBirthday =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  return age > 18 || (age === 18 && hadBirthday);
}
