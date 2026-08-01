import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const PUBLIC_ROUTES = ["/login", "/esqueci-senha"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute =
    PUBLIC_ROUTES.some((route) => pathname === route) || pathname.startsWith("/redefinir-senha");
  const isAdminRoute = pathname.startsWith("/admin");
  const isDashboardRoute = pathname.startsWith("/dashboard");

  const session = await decryptSession(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!session && (isAdminRoute || isDashboardRoute)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && isPublicRoute) {
    return NextResponse.redirect(new URL(session.role === "ADMIN" ? "/admin" : "/dashboard", request.url));
  }

  if (session && isAdminRoute && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
};
