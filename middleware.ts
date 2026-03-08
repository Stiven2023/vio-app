import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/erp/login",
  "/mes",
  "/crm",
  "/en-construccion",
  "/erp",
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("auth_token")?.value;
  const externalToken = request.cookies.get("external_access_token")?.value;

  const isErpPrefixed = pathname.startsWith("/erp/") && pathname !== "/erp/login";
  const normalizedPath = isErpPrefixed ? pathname.replace(/^\/erp/, "") || "/" : pathname;

  if (pathname === "/login") {
    const erpLoginUrl = request.nextUrl.clone();
    erpLoginUrl.pathname = "/erp/login";
    erpLoginUrl.search = "";
    return NextResponse.redirect(erpLoginUrl);
  }

  if (normalizedPath.startsWith("/portal")) {
    if (!externalToken) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/erp/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
  }

  if ((normalizedPath === "/login" || pathname === "/erp/login") && token) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/erp/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  if (PUBLIC_PATHS.has(pathname) || PUBLIC_PATHS.has(normalizedPath)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/mes/") || pathname.startsWith("/crm/")) {
    return NextResponse.next();
  }

  if (normalizedPath.startsWith("/en-construccion")) {
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/erp/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (
    !isErpPrefixed &&
    !pathname.startsWith("/portal") &&
    !pathname.startsWith("/mes") &&
    !pathname.startsWith("/crm") &&
    !PUBLIC_PATHS.has(pathname)
  ) {
    const canonicalErpUrl = request.nextUrl.clone();
    canonicalErpUrl.pathname = `/erp${pathname}`;
    return NextResponse.redirect(canonicalErpUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
