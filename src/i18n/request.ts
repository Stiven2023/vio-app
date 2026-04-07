import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { getMessagesForLocale } from "@/i18n";
import { routing } from "@/src/i18n/routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;

  let locale: (typeof routing.locales)[number];

  if (hasLocale(routing.locales, requestedLocale)) {
    // Locale comes from URL (e.g. /es/home)
    locale = requestedLocale;
  } else {
    // Non-locale routes (e.g. /erp, /mes, /hcm) — read from cookie
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;

    locale = hasLocale(routing.locales, cookieLocale)
      ? cookieLocale
      : routing.defaultLocale;
  }

  return {
    locale,
    messages: await getMessagesForLocale(locale),
  };
});
