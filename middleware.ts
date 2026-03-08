import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = new Set([
  "/login",
  "/en-construccion",
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("auth_token")?.value;
  const externalToken = request.cookies.get("external_access_token")?.value;

  const isErpPrefixed = pathname.startsWith("/erp/") && pathname !== "/erp/login";
  const normalizedPath = isErpPrefixed ? pathname.replace(/^\/erp/, "") || "/" : pathname;

  if (pathname === "/erp/login") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (normalizedPath.startsWith("/portal")) {
    if (!externalToken) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
  }

  if (normalizedPath === "/login" && token) {
    const selectorUrl = request.nextUrl.clone();
    selectorUrl.pathname = "/";
    selectorUrl.search = "";
    return NextResponse.redirect(selectorUrl);
  }

  if (PUBLIC_PATHS.has(pathname) || PUBLIC_PATHS.has(normalizedPath)) {
    return NextResponse.next();
  }

  if (normalizedPath.startsWith("/en-construccion")) {
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (
    pathname !== "/" &&
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
