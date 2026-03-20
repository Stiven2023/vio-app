"use client";

import { useEffect, useMemo, useState } from "react";
import { Select, SelectItem } from "@heroui/select";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Language = "en" | "es";

const STORAGE_KEY = "preferredLanguage";

function removeLocalePrefix(pathname: string) {
  const nextPath = pathname.replace(/^\/(en|es)(?=\/|$)/, "");

  return nextPath || "/";
}

function withLocale(pathname: string, language: Language) {
  const pathWithoutLocale = removeLocalePrefix(pathname);

  if (language === "en") {
    return pathWithoutLocale;
  }

  return pathWithoutLocale === "/" ? "/es" : `/es${pathWithoutLocale}`;
}

export function LanguageSelector({ locale }: { locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentLanguage: Language = locale === "es" ? "es" : "en";
  const [selectedLanguage, setSelectedLanguage] =
    useState<Language>(currentLanguage);

  useEffect(() => {
    setSelectedLanguage(currentLanguage);
  }, [currentLanguage]);

  const nextSearch = useMemo(() => {
    const search = searchParams.toString();

    return search ? `?${search}` : "";
  }, [searchParams]);

  return (
    <Select
      aria-label="Language selector"
      className="w-36"
      selectedKeys={[selectedLanguage]}
      size="sm"
      variant="bordered"
      onSelectionChange={(keys) => {
        const nextLanguage = String(Array.from(keys)[0] ?? "en") as Language;

        if (nextLanguage !== "en" && nextLanguage !== "es") return;

        setSelectedLanguage(nextLanguage);
        localStorage.setItem(STORAGE_KEY, nextLanguage);

        const nextPath = withLocale(pathname || "/", nextLanguage);

        router.replace(`${nextPath}${nextSearch}`);
      }}
    >
      <SelectItem key="en">English</SelectItem>
      <SelectItem key="es">Espanol</SelectItem>
    </Select>
  );
}
