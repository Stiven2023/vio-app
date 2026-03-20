export const locales = ["es", "en"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

export async function getMessagesForLocale(locale: string) {
  const normalizedLocale: AppLocale = locale === "es" ? "es" : "en";

  return (await import(`./messages/${normalizedLocale}.json`)).default;
}
