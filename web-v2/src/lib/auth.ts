import "server-only";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
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

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wrap a route handler with uniform auth-error → JSON response mapping. */
export function withAuth<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof AuthError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      console.error(err);
      return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
  };
}
