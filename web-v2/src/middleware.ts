import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = ["/login"];
/** Paths accessible without a full session (setup requires its own ticket, checked client-side). */
const TICKET_PATHS = ["/setup"];
const STUDENT_ALLOWED = ["/me"];

function parseJwt(token: string): { role?: string; exp?: number } | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (decoded.exp && decoded.exp * 1000 < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes: skip i18n, auth checked inside each route handler
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Strip locale prefix to get logical path
  const localePattern = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);
  const pathnameWithoutLocale = pathname.replace(localePattern, "") || "/";

  const token = request.cookies.get("token")?.value;
  const session = token ? parseJwt(token) : null;

  // Root → redirect by session
  if (pathnameWithoutLocale === "/") {
    const url = request.nextUrl.clone();
    url.pathname = session
      ? session.role === "STUDENT"
        ? "/me"
        : "/console"
      : "/login";
    return NextResponse.redirect(url);
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathnameWithoutLocale === p || pathnameWithoutLocale.startsWith(p + "/"),
  );
  const isTicketPath = TICKET_PATHS.some(
    (p) => pathnameWithoutLocale === p || pathnameWithoutLocale.startsWith(p + "/"),
  );

  // Logged-in user visiting /login → send to their home
  if (isPublic && session) {
    const url = request.nextUrl.clone();
    url.pathname = session.role === "STUDENT" ? "/me" : "/console";
    return NextResponse.redirect(url);
  }

  // /setup requires a setup ticket (or an existing session)
  if (isTicketPath && !session) {
    const ticket = request.cookies.get("setup_ticket")?.value;
    if (!ticket) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  // Unauthenticated → /login (except public & ticket paths)
  if (!isPublic && !isTicketPath && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Students may only access /me
  if (session?.role === "STUDENT") {
    const allowed = STUDENT_ALLOWED.some(
      (p) => pathnameWithoutLocale === p || pathnameWithoutLocale.startsWith(p + "/"),
    );
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/me";
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
