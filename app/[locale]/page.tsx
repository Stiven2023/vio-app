import { getTranslations } from "next-intl/server";

import { HomeModuleSelector } from "@/app/_components/home-module-selector";
import { LanguageSelector } from "@/components/language-selector";

export default async function LocalizedHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("HomePage");

  return (
    <>
      <section className="border-b border-default-200 bg-content1 px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.24em] text-primary">
              {t("localeLabel")}: {t("localeValue")}
            </p>
            <LanguageSelector locale={locale} />
          </div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary">
            {t("switchLabel")}
          </p>
          <h1 className="text-2xl font-semibold text-foreground">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-sm text-default-600">
            {t("description")}
          </p>
        </div>
      </section>
      <HomeModuleSelector />
    </>
  );
}
