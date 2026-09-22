import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function parseJwtPayload(token: string): { role?: string; id?: string; studentId?: string; name?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const binaryStr = atob(base64);
    const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
    const jsonStr = new TextDecoder().decode(bytes);
    const payload = JSON.parse(jsonStr);

    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('token')?.value;
  const user = token ? parseJwtPayload(token) : null;
  const isAuthenticated = !!user;

  const redirectTo = (path: string) => {
    const url = req.nextUrl.clone();
    url.pathname = path;
    url.search = '';
    return NextResponse.redirect(url);
  };

  // 1. Root path (/)
  // Unauthenticated users go to /login ("登录入口必须是未登录的人看到的")
  // Authenticated users go to /dashboard (which displays either student or TA panel)
  if (pathname === '/') {
    if (isAuthenticated) {
      return redirectTo('/dashboard');
    } else {
      return redirectTo('/login');
    }
  }

  // 2. Login page (/login)
  // Already logged-in users must be redirected to /dashboard
  if (pathname === '/login') {
    if (isAuthenticated) {
      return redirectTo('/dashboard');
    }
    return NextResponse.next();
  }

  // 3. Dashboard (/dashboard)
  // Protected: unauthenticated users redirected to /login
  if (pathname === '/dashboard') {
    if (!isAuthenticated) {
      return redirectTo('/login');
    }
    return NextResponse.next();
  }

  // 4. TA-only pages: /experiments, /assignments, /boards
  if (
    pathname.startsWith('/experiments') ||
    pathname.startsWith('/assignments') ||
    pathname.startsWith('/boards')
  ) {
    if (!isAuthenticated) {
      return redirectTo('/login');
    }
    if (user?.role === 'STUDENT') {
      return redirectTo('/dashboard');
    }
    return NextResponse.next();
  }

  // 5. Protected API routes (excluding /api/auth which is bypassed in matcher)
  if (pathname.startsWith('/api/')) {
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (
      user?.role === 'STUDENT' &&
      (pathname.startsWith('/api/experiments') || pathname.startsWith('/api/boards') || pathname.startsWith('/api/courses'))
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (auth routes: login, logout, zjuam, passkey, session)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, and common media extensions
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
