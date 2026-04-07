import { eq } from "drizzle-orm";

import {
  fabrics,
  moldingTemplateFabrics,
  moldingTemplates,
} from "@/src/db/erp/schema";

export function splitLegacyCompatibleFabrics(value: string | null | undefined) {
  return String(value ?? "")
    .split(/[,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

type DbLike = {
  select: (...args: any[]) => any;
};

export async function isMoldingFabricCompatible(args: {
  dbOrTx: DbLike;
  moldingTemplateId: string;
  fabricName: string;
}): Promise<boolean> {
  const { dbOrTx, moldingTemplateId, fabricName } = args;
  const normalizedFabricName = fabricName.trim();

  if (!normalizedFabricName) return false;

  const links = await dbOrTx
    .select({
      fabricName: fabrics.name,
      isActive: fabrics.isActive,
    })
    .from(moldingTemplateFabrics)
    .innerJoin(fabrics, eq(moldingTemplateFabrics.fabricId, fabrics.id))
    .where(eq(moldingTemplateFabrics.moldingTemplateId, moldingTemplateId));

  if (links.length > 0) {
    return links.some(
      (row: { fabricName: string | null; isActive: boolean | null }) =>
        row.isActive !== false &&
        String(row.fabricName ?? "").toLowerCase() ===
          normalizedFabricName.toLowerCase(),
    );
  }

  const [legacyTemplate] = await dbOrTx
    .select({
      fabric: moldingTemplates.fabric,
      compatibleFabrics: moldingTemplates.compatibleFabrics,
    })
    .from(moldingTemplates)
    .where(eq(moldingTemplates.id, moldingTemplateId))
    .limit(1);

  if (!legacyTemplate) return false;

  const directFabric = String(legacyTemplate.fabric ?? "").trim();

  if (
    directFabric &&
    directFabric.toLowerCase() === normalizedFabricName.toLowerCase()
  ) {
    return true;
  }

  const legacyList = splitLegacyCompatibleFabrics(
    legacyTemplate.compatibleFabrics,
  );

  return legacyList.some(
    (legacyFabric) =>
      legacyFabric.toLowerCase() === normalizedFabricName.toLowerCase(),
  );
}

export async function listTemplateCompatibleFabrics(args: {
  dbOrTx: DbLike;
  moldingTemplateId: string;
}) {
  const { dbOrTx, moldingTemplateId } = args;

  const rows = await dbOrTx
    .select({
      id: fabrics.id,
      name: fabrics.name,
      category: fabrics.category,
      isActive: fabrics.isActive,
      sortOrder: moldingTemplateFabrics.sortOrder,
      note: moldingTemplateFabrics.note,
    })
    .from(moldingTemplateFabrics)
    .innerJoin(fabrics, eq(moldingTemplateFabrics.fabricId, fabrics.id))
    .where(eq(moldingTemplateFabrics.moldingTemplateId, moldingTemplateId))
    .orderBy(moldingTemplateFabrics.sortOrder, fabrics.name);

  return rows;
}
