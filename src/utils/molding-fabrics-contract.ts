import { z } from "zod";

import { FabricCategoryEnum } from "@/src/db/enums";

export const fabricsQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  category: FabricCategoryEnum.optional(),
  activeOnly: z.coerce.boolean().optional().default(true),
});

export const moldingTemplateFabricParamsSchema = z.object({
  id: z.string().uuid(),
});

export const moldingTemplateFabricLinkSchema = z.object({
  fabricId: z.string().uuid(),
  sortOrder: z.number().int().positive().optional(),
  note: z.string().trim().max(255).optional().nullable(),
});

export const moldingTemplateFabricUpsertSchema = z
  .object({
    fabricIds: z.array(z.string().uuid()).optional(),
    fabricLinks: z.array(moldingTemplateFabricLinkSchema).optional(),
  })
  .refine((data) => data.fabricIds !== undefined || data.fabricLinks !== undefined, {
    message: "Debes enviar fabricIds o fabricLinks.",
    path: ["fabricIds"],
  });
