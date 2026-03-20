import type { AppLocale } from "@/i18n";

import en from "@/messages/en.json";
import es from "@/messages/es.json";

type MessageNode = {
  [key: string]: MessageNode | string;
};

const dictionaries: Record<AppLocale, MessageNode> = {
  en: en as MessageNode,
  es: es as MessageNode,
};

function getValueByPath(source: MessageNode, key: string): string | null {
  const parts = key.split(".").filter(Boolean);
  let current: MessageNode | string | undefined = source;

  for (const part of parts) {
    if (!current || typeof current === "string") {
      return null;
    }

    current = current[part];
  }

  return typeof current === "string" ? current : null;
}

export function translate(key: string, lang: AppLocale): string {
  const dictionary = dictionaries[lang] ?? dictionaries.en;
  const value = getValueByPath(dictionary, key);

  if (value) return value;

  return getValueByPath(dictionaries.en, key) ?? key;
}
