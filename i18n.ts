export const locales = ["es", "en"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "es";

export async function getMessagesForLocale(locale: string) {
  const normalizedLocale = locale === "en" ? "en" : defaultLocale;

  return (await import(`./messages/${normalizedLocale}.json`)).default;
}
