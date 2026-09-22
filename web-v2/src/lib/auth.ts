import "server-only";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { env } from "./env";

export type Role = "STUDENT" | "TA" | "TEACHER";

export interface SessionUser {
  id: string;
  studentId: string;
  name: string;
  role: Role;
}

const COOKIE_NAME = "token";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function signSession(user: SessionUser): string {
  return jwt.sign(user, env.jwtSecret, { expiresIn: MAX_AGE });
}

export async function setSessionCookie(user: SessionUser) {
  const store = await cookies();
  store.set(COOKIE_NAME, signSession(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, env.jwtSecret) as SessionUser;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError(401, "UNAUTHORIZED");
  return session;
}

export async function requireStaff(): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== "TA" && session.role !== "TEACHER") {
    throw new AuthError(403, "FORBIDDEN");
  }
  return session;
}

export async function requireTA(): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== "TA") {
    throw new AuthError(403, "FORBIDDEN");
  }
  return session;
}

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/* ------------------------------------------------------- */
/* Setup ticket: short-lived credential proving identity    */
/* via ZJUAM (or future token), allowing first-time TA      */
/* profile setup (username/password/passkey).               */
/* ------------------------------------------------------- */

const SETUP_COOKIE = "setup_ticket";

export interface SetupTicket {
  studentId: string;
  name: string;
}

export async function setSetupTicket(ticket: SetupTicket) {
  const store = await cookies();
  const token = jwt.sign(ticket, env.jwtSecret, { expiresIn: "15m" });
  store.set(SETUP_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60,
    path: "/",
  });
}

export async function getSetupTicket(): Promise<SetupTicket | null> {
  const store = await cookies();
  const token = store.get(SETUP_COOKIE)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, env.jwtSecret) as SetupTicket;
  } catch {
    return null;
  }
}

export async function clearSetupTicket() {
  const store = await cookies();
  store.delete(SETUP_COOKIE);
}

/** Uniform API error shape: `{ error: CODE, issues?: [...] }`. */
export function apiError(status: number, code: string, issues?: unknown) {
  return Response.json({ error: code, ...(issues ? { issues } : {}) }, { status });
}

/** Wrap a route handler with uniform error → structured JSON mapping. */
export function withAuth<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof AuthError) {
        return apiError(err.status, err.message);
      }
      if (err instanceof ZodError) {
        return apiError(
          400,
          "VALIDATION_ERROR",
          err.issues.map((i) => ({ path: i.path.join("."), code: i.code, message: i.message })),
        );
      }
      if (err instanceof SyntaxError) {
        return apiError(400, "INVALID_JSON");
      }
      console.error(err);
      return apiError(500, "INTERNAL_ERROR");
    }
  };
}
