import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "bhcw_master";
const MAX_AGE = 60 * 60 * 24 * 14;

function secret(): string {
  return process.env.MASTER_SESSION_SECRET || "dev-only-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function masterPassword(): string {
  return (process.env.MASTER_CONTROL_PASSWORD || "").trim();
}

export function passwordConfigured(): boolean {
  return masterPassword().length >= 8;
}

export function checkPassword(input: string): boolean {
  const expected = masterPassword();
  const given = input.trim();
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function makeSessionToken(): string {
  const body = `${Date.now()}.${randomBytes(16).toString("hex")}`;
  return `${body}.${sign(body)}`;
}

export function validSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [ts, nonce, mac] = parts;
  if (!ts || !nonce || !mac) return false;
  const body = `${ts}.${nonce}`;
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;
  const born = Number(ts);
  if (!Number.isFinite(born)) return false;
  return Date.now() - born < MAX_AGE * 1000;
}

export async function isMaster(): Promise<boolean> {
  const jar = await cookies();
  return validSessionToken(jar.get(COOKIE)?.value);
}

export function sessionCookieHeader(token: string): string {
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}

export function clearSessionCookieHeader(): string {
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
