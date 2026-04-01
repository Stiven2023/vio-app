import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = "en";

  setRequestLocale(locale);
  const messages = await getMessages({ locale } as Parameters<typeof getMessages>[0]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
