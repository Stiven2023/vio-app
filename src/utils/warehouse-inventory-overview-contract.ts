import { z } from "zod";

const booleanLike = z
  .union([z.boolean(), z.string(), z.number(), z.null(), z.undefined()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === "") return false;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;

    const normalized = String(value).trim().toLowerCase();

    if (["true", "1", "yes", "si", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;

    return false;
  });

export const warehouseInventoryOverviewQuerySchema = z.object({
  includeInactive: booleanLike,
});
