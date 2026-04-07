import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";

type Locale = "en" | "es";

async function getMessages(locale: Locale) {
  return (await import(`@/messages/${locale}.json`)).default as Record<
    string,
    unknown
  >;
}

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value;
  const locale: Locale = raw === "es" ? "es" : "en";
  const messages = await getMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
