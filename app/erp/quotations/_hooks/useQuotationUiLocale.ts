"use client";

import type { UiLocale } from "../_lib/types";

import { useEffect, useState } from "react";

import { resolveQuotationUiLocale } from "../_lib/utils";

export function useQuotationUiLocale(
  initialLocale: UiLocale = "en",
): UiLocale {
  const [locale, setLocale] = useState<UiLocale>(initialLocale);

  useEffect(() => {
    setLocale(resolveQuotationUiLocale());
  }, []);

  return locale;
}