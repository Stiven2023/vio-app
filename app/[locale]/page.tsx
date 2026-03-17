import { useTranslations } from "next-intl";

import { HomeModuleSelector } from "@/app/_components/home-module-selector";

export default function LocalizedHomePage() {
  const t = useTranslations("HomePage");

  return (
    <>
      <section className="border-b border-default-200 bg-content1 px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.24em] text-primary">
            {t("localeLabel")}: {t("localeValue")}
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
