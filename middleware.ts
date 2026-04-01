import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

import { routing } from "@/src/i18n/routing";

const PUBLIC_PATHS = new Set(["/login", "/hcm-legacy-retired"]);

const LEGACY_PREFIX_MAPPINGS: Array<[string, string]> = [
  ["/en-construccion", "/under-construction"],
  ["/costos", "/costs"],
  ["/portal/rrhh", "/portal/hcm"],
  ["/portal/rh", "/portal/hcm"],
  ["/portal/hr", "/portal/hcm"],
  ["/rrhh", "/hcm"],
  ["/rh", "/hcm"],
  ["/hr", "/hcm"],
  ["/molderia", "/patterns"],
  ["/juridica", "/legal"],
];

const INTERNAL_PATH_PREFIXES = ["/erp", "/mes", "/crm", "/hcm", "/portal"];
const LOCALE_PATH_REGEX = /^\/(es|en)(?=\/|$)/;
const LEGACY_HCM_PATHS = [
  "/rrhh",
  "/rh",
  "/hr",
  "/portal/rrhh",
  "/portal/rh",
  "/portal/hr",
] as const;
const DEFAULT_LEGACY_HCM_RETIRE_AT = "2026-12-31T00:00:00.000Z";
const LEGACY_HCM_RETIRE_AT =
  process.env.LEGACY_HCM_RETIRE_AT ?? DEFAULT_LEGACY_HCM_RETIRE_AT;
const LEGACY_HCM_RETIRE_MODE =
  process.env.LEGACY_HCM_RETIRE_MODE ?? "block";

const handleI18nRouting = createIntlMiddleware(routing);

function readLocalePrefix(pathname: string) {
  const match = pathname.match(LOCALE_PATH_REGEX);

  return match?.[0] ?? "";
}

function removeLocalePrefix(pathname: string) {
  const localePrefix = readLocalePrefix(pathname);

  if (!localePrefix) return pathname;

  return pathname.slice(localePrefix.length) || "/";
}

function isLocalizedPath(pathname: string) {
  return pathname === "/" || LOCALE_PATH_REGEX.test(pathname);
}

function mapLegacyPrefix(pathname: string) {
  for (const [legacyPrefix, nextPrefix] of LEGACY_PREFIX_MAPPINGS) {
    if (pathname === legacyPrefix || pathname.startsWith(`${legacyPrefix}/`)) {
      return pathname.replace(legacyPrefix, nextPrefix);
    }
  }

  return pathname;
}

function isLegacyHcmPath(pathname: string) {
  return LEGACY_HCM_PATHS.some(
    (legacyPath) =>
      pathname === legacyPath || pathname.startsWith(`${legacyPath}/`),
  );
}

function isLegacyHcmRetired() {
  const retireAtMs = Date.parse(LEGACY_HCM_RETIRE_AT);

  if (Number.isNaN(retireAtMs)) return false;

  return Date.now() >= retireAtMs;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("auth_token")?.value;
  const externalToken = request.cookies.get("external_access_token")?.value;

  const localePrefix = readLocalePrefix(pathname);
  const localeAgnosticPath = removeLocalePrefix(pathname);

  if (
    localePrefix &&
    INTERNAL_PATH_PREFIXES.some(
      (prefix) =>
        localeAgnosticPath === prefix ||
        localeAgnosticPath.startsWith(`${prefix}/`),
    )
  ) {
    const canonicalUrl = request.nextUrl.clone();

    canonicalUrl.pathname = localeAgnosticPath;
    canonicalUrl.search = "";

    return NextResponse.redirect(canonicalUrl);
  }

  const isErpPrefixed =
    localeAgnosticPath.startsWith("/erp/") &&
    localeAgnosticPath !== "/erp/login";
  const normalizedPath = isErpPrefixed
    ? localeAgnosticPath.replace(/^\/erp/, "") || "/"
    : localeAgnosticPath;

  const mappedNormalizedPath = mapLegacyPrefix(normalizedPath);

  if (mappedNormalizedPath !== normalizedPath) {
    const legacyRedirectUrl = request.nextUrl.clone();
    const legacySourcePath = isErpPrefixed
      ? `/erp${normalizedPath}`
      : normalizedPath;

    legacyRedirectUrl.pathname = isErpPrefixed
      ? `/erp${mappedNormalizedPath}`
      : mappedNormalizedPath;

    if (isLegacyHcmPath(normalizedPath)) {
      if (isLegacyHcmRetired()) {
        if (LEGACY_HCM_RETIRE_MODE === "redirect") {
          console.warn(
            `[middleware] Legacy HCM route retired but redirected by mode=redirect: ${legacySourcePath} -> ${legacyRedirectUrl.pathname}`,
          );

          return NextResponse.redirect(legacyRedirectUrl);
        }

        console.warn(
          `[middleware] Legacy HCM route blocked (retired): ${legacySourcePath}`,
        );

        const retiredUrl = request.nextUrl.clone();

        retiredUrl.pathname = "/hcm-legacy-retired";
        retiredUrl.search = "";
        retiredUrl.searchParams.set("from", legacySourcePath);

        return NextResponse.rewrite(retiredUrl, { status: 410 });
      }
      console.info(
        `[middleware] Legacy HCM route redirected: ${legacySourcePath} -> ${legacyRedirectUrl.pathname}`,
      );
    }

    return NextResponse.redirect(legacyRedirectUrl);
  }

  if (localeAgnosticPath === "/erp/login") {
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

  if (normalizedPath.startsWith("/under-construction")) {
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = "/login";
    loginUrl.search = "";

    return NextResponse.redirect(loginUrl);
  }

  if (
    localeAgnosticPath !== "/" &&
    !localePrefix &&
    !isErpPrefixed &&
    !localeAgnosticPath.startsWith("/portal") &&
    !localeAgnosticPath.startsWith("/mes") &&
    !localeAgnosticPath.startsWith("/crm") &&
    !localeAgnosticPath.startsWith("/hcm") &&
    !PUBLIC_PATHS.has(localeAgnosticPath)
  ) {
    const canonicalErpUrl = request.nextUrl.clone();

    canonicalErpUrl.pathname = `/erp${localeAgnosticPath}`;

    return NextResponse.redirect(canonicalErpUrl);
  }

  if (isLocalizedPath(pathname)) {
    return handleI18nRouting(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
