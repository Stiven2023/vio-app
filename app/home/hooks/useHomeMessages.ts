"use client";

import { useTranslations } from "next-intl";

export function useHomeMessages() {
  const homePageTranslations = useTranslations("HomePage");
  const moduleTranslations = useTranslations("HomeModules");
  const currentYear = new Date().getFullYear();

  return {
    enterpriseSystemLabel: homePageTranslations("enterpriseSystemLabel"),
    selectModuleLabel: homePageTranslations("selectModuleLabel"),
    logoutLabel: homePageTranslations("logoutLabel"),
    languageEnglish: homePageTranslations("languageEnglish"),
    languageSpanish: homePageTranslations("languageSpanish"),
    enterButtonLabel: homePageTranslations("enterButtonLabel"),
    copyrightText: homePageTranslations("copyrightText", { year: currentYear }),
    timeZone: homePageTranslations("timeZone"),
    modules: {
      erp: {
        title: moduleTranslations("erp.title"),
        fullTitle: moduleTranslations("erp.fullTitle"),
        description: moduleTranslations("erp.description"),
        accentWord: moduleTranslations("erp.accentWord"),
        statLabel: moduleTranslations("erp.statLabel"),
        statValue: moduleTranslations("erp.statValue"),
      },
      mes: {
        title: moduleTranslations("mes.title"),
        fullTitle: moduleTranslations("mes.fullTitle"),
        description: moduleTranslations("mes.description"),
        accentWord: moduleTranslations("mes.accentWord"),
        statLabel: moduleTranslations("mes.statLabel"),
        statValue: moduleTranslations("mes.statValue"),
      },
      crm: {
        title: moduleTranslations("crm.title"),
        fullTitle: moduleTranslations("crm.fullTitle"),
        description: moduleTranslations("crm.description"),
        accentWord: moduleTranslations("crm.accentWord"),
        statLabel: moduleTranslations("crm.statLabel"),
        statValue: moduleTranslations("crm.statValue"),
      },
      hcm: {
        title: moduleTranslations("hcm.title"),
        fullTitle: moduleTranslations("hcm.fullTitle"),
        description: moduleTranslations("hcm.description"),
        accentWord: moduleTranslations("hcm.accentWord"),
        statLabel: moduleTranslations("hcm.statLabel"),
        statValue: moduleTranslations("hcm.statValue"),
      },
    },
  };
}
