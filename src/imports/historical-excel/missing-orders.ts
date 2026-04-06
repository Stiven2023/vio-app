import { normalizeText } from "@/src/imports/historical-excel/helpers";

export const validMissingOrderPrefixes = ["VN", "VT", "VI", "VW", "VR", "VP"] as const;

export type MissingOrderSource = "despacho" | "ventas";

export type MissingOrderClassification =
  | "invalid_prefix"
  | "shared_missing"
  | "single_flow_missing";

export type MissingOrderAction =
  | "revisar_codigo_origen"
  | "crear_o_migrar_pedido_en_erp"
  | "prioridad_alta_crear_o_migrar_en_erp";

export type MissingOrderEntry = {
  orderCode: string;
  prefix: string | null;
  numericPart: string | null;
  isValidPrefix: boolean;
  appearsIn: MissingOrderSource[];
  classification: MissingOrderClassification;
  recommendedAction: MissingOrderAction;
};

export function parseMissingOrderCode(orderCode: string) {
  const normalized = normalizeText(orderCode).toUpperCase();
  const match = normalized.match(/^([A-Z]{2})\s*-\s*(\d+)$/);

  if (!match) {
    return {
      normalized,
      prefix: null,
      numericPart: null,
    };
  }

  return {
    normalized: `${match[1]} - ${match[2]}`,
    prefix: match[1],
    numericPart: match[2],
  };
}

export function classifyMissingOrders(input: Record<MissingOrderSource, string[]>) {
  const sourceByCode = new Map<string, Set<MissingOrderSource>>();

  for (const [source, codes] of Object.entries(input) as Array<[MissingOrderSource, string[]]>) {
    for (const rawCode of codes) {
      const parsed = parseMissingOrderCode(rawCode);
      if (!parsed.normalized) {
        continue;
      }

      const existing = sourceByCode.get(parsed.normalized) ?? new Set<MissingOrderSource>();
      existing.add(source);
      sourceByCode.set(parsed.normalized, existing);
    }
  }

  return Array.from(sourceByCode.entries())
    .map(([orderCode, sources]): MissingOrderEntry => {
      const parsed = parseMissingOrderCode(orderCode);
      const appearsIn = Array.from(sources).sort((a, b) => a.localeCompare(b));
      const isValidPrefix = Boolean(
        parsed.prefix && validMissingOrderPrefixes.includes(parsed.prefix as (typeof validMissingOrderPrefixes)[number]),
      );

      if (!isValidPrefix) {
        return {
          orderCode,
          prefix: parsed.prefix,
          numericPart: parsed.numericPart,
          isValidPrefix,
          appearsIn,
          classification: "invalid_prefix",
          recommendedAction: "revisar_codigo_origen",
        };
      }

      if (appearsIn.length > 1) {
        return {
          orderCode,
          prefix: parsed.prefix,
          numericPart: parsed.numericPart,
          isValidPrefix,
          appearsIn,
          classification: "shared_missing",
          recommendedAction: "prioridad_alta_crear_o_migrar_en_erp",
        };
      }

      return {
        orderCode,
        prefix: parsed.prefix,
        numericPart: parsed.numericPart,
        isValidPrefix,
        appearsIn,
        classification: "single_flow_missing",
        recommendedAction: "crear_o_migrar_pedido_en_erp",
      };
    })
    .sort((left, right) => left.orderCode.localeCompare(right.orderCode));
}

export function buildMissingOrdersCsv(entries: MissingOrderEntry[]) {
  const header = [
    "orderCode",
    "prefix",
    "numericPart",
    "isValidPrefix",
    "appearsIn",
    "classification",
    "recommendedAction",
  ];

  const rows = entries.map((entry) => [
    entry.orderCode,
    entry.prefix ?? "",
    entry.numericPart ?? "",
    String(entry.isValidPrefix),
    entry.appearsIn.join("|"),
    entry.classification,
    entry.recommendedAction,
  ]);

  return [header, ...rows]
    .map((columns) => columns.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}