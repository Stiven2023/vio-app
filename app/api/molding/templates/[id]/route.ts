import { eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  employees,
  fabrics,
  moldingTemplateFabrics,
  moldingTemplateInsumos,
  moldingTemplates,
} from "@/src/db/erp/schema";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { listTemplateCompatibleFabrics } from "@/src/utils/molding-fabric-compat";
import { moldingTemplateFabricUpsertSchema } from "@/src/utils/molding-fabrics-contract";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function normalizeUpper(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

const PANTALONETA_SUBTYPE_OPTIONS = [
  "VOLEY",
  "PETO",
  "BALONCESTO",
  "PROMESAS",
  "DOBLE FAZ",
] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "molding-templates-id:get",
    limit: 150,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MOLDERIA");

  if (forbidden) return forbidden;

  const { id } = await params;

  try {
    const [template] = await db
      .select({
        id: moldingTemplates.id,
        moldingCode: moldingTemplates.moldingCode,
        version: moldingTemplates.version,
        garmentType: moldingTemplates.garmentType,
        garmentSubtype: moldingTemplates.garmentSubtype,
        designDetail: moldingTemplates.designDetail,
        fabric: moldingTemplates.fabric,
        color: moldingTemplates.color,
        gender: moldingTemplates.gender,
        imageUrl: moldingTemplates.imageUrl,
        clothingImageOneUrl: moldingTemplates.clothingImageOneUrl,
        clothingImageTwoUrl: moldingTemplates.clothingImageTwoUrl,
        logoImageUrl: moldingTemplates.logoImageUrl,
        process: moldingTemplates.process,
        estimatedLeadDays: moldingTemplates.estimatedLeadDays,
        manufacturingId: moldingTemplates.manufacturingId,
        screenPrint: moldingTemplates.screenPrint,
        embroidery: moldingTemplates.embroidery,
        buttonhole: moldingTemplates.buttonhole,
        snap: moldingTemplates.snap,
        tag: moldingTemplates.tag,
        flag: moldingTemplates.flag,
        neckType: moldingTemplates.neckType,
        sesgoType: moldingTemplates.sesgoType,
        sesgoColor: moldingTemplates.sesgoColor,
        hiladillaColor: moldingTemplates.hiladillaColor,
        sleeveType: moldingTemplates.sleeveType,
        cuffType: moldingTemplates.cuffType,
        cuffMaterial: moldingTemplates.cuffMaterial,
        zipperLocation: moldingTemplates.zipperLocation,
        zipperColor: moldingTemplates.zipperColor,
        zipperSizeCm: moldingTemplates.zipperSizeCm,
        cordColor: moldingTemplates.cordColor,
        hasElastic: moldingTemplates.hasElastic,
        liningType: moldingTemplates.liningType,
        liningColor: moldingTemplates.liningColor,
        hoodType: moldingTemplates.hoodType,
        hasInnerLining: moldingTemplates.hasInnerLining,
        hasPocket: moldingTemplates.hasPocket,
        pocketZipperColor: moldingTemplates.pocketZipperColor,
        hasLateralMesh: moldingTemplates.hasLateralMesh,
        lateralMeshColor: moldingTemplates.lateralMeshColor,
        hasFajon: moldingTemplates.hasFajon,
        hasTanca: moldingTemplates.hasTanca,
        hasProtection: moldingTemplates.hasProtection,
        buttonType: moldingTemplates.buttonType,
        buttonholeType: moldingTemplates.buttonholeType,
        perillaColor: moldingTemplates.perillaColor,
        collarType: moldingTemplates.collarType,
        fusioningNotes: moldingTemplates.fusioningNotes,
        hasEntretela: moldingTemplates.hasEntretela,
        invisibleZipperColor: moldingTemplates.invisibleZipperColor,
        observations: moldingTemplates.observations,
        compatibleFabrics: moldingTemplates.compatibleFabrics,
        isActive: moldingTemplates.isActive,
        deprecatedAt: moldingTemplates.deprecatedAt,
        createdBy: moldingTemplates.createdBy,
        createdByName: employees.name,
        createdAt: moldingTemplates.createdAt,
        updatedAt: moldingTemplates.updatedAt,
      })
      .from(moldingTemplates)
      .leftJoin(employees, eq(moldingTemplates.createdBy, employees.id))
      .where(eq(moldingTemplates.id, id))
      .limit(1);

    if (!template) {
      return jsonError(404, "MOLDING_TEMPLATE_NOT_FOUND", "Molderia no encontrada.");
    }

    const insumos = await db
      .select()
      .from(moldingTemplateInsumos)
      .where(eq(moldingTemplateInsumos.moldingTemplateId, id));

    const fabrics = await listTemplateCompatibleFabrics({
      dbOrTx: db,
      moldingTemplateId: id,
    });

    return Response.json({ ...template, insumos, fabrics });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return jsonError(
      500,
      "MOLDING_TEMPLATE_FETCH_FAILED",
      "No se pudo consultar la molderia.",
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "molding-templates-id:patch",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_MOLDERIA");

  if (forbidden) return forbidden;

  const { id } = await params;

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, "INVALID_JSON", "JSON invalido.");
  }

  const existing = await db
    .select({
      id: moldingTemplates.id,
      garmentType: moldingTemplates.garmentType,
      garmentSubtype: moldingTemplates.garmentSubtype,
      neckType: moldingTemplates.neckType,
      hasProtection: moldingTemplates.hasProtection,
      hasPocket: moldingTemplates.hasPocket,
      hasTanca: moldingTemplates.hasTanca,
      hasElastic: moldingTemplates.hasElastic,
      hasLateralMesh: moldingTemplates.hasLateralMesh,
      cordColor: moldingTemplates.cordColor,
      lateralMeshColor: moldingTemplates.lateralMeshColor,
    })
    .from(moldingTemplates)
    .where(eq(moldingTemplates.id, id))
    .limit(1);

  if (existing.length === 0) {
    return jsonError(404, "MOLDING_TEMPLATE_NOT_FOUND", "Molderia no encontrada.");
  }

  const upsertInput =
    body.fabricIds !== undefined || body.fabricLinks !== undefined
      ? {
          fabricIds: Array.isArray(body.fabricIds) ? body.fabricIds : undefined,
          fabricLinks: Array.isArray(body.fabricLinks) ? body.fabricLinks : undefined,
        }
      : null;

  const parsedLinks = upsertInput
    ? moldingTemplateFabricUpsertSchema.safeParse(upsertInput)
    : null;

  if (parsedLinks && !parsedLinks.success) {
    return zodFirstErrorEnvelope(
      parsedLinks.error,
      "Compatibilidades de telas invalidas.",
    );
  }

  function parseStr(v: unknown, maxLen = 255): string | null | undefined {
    if (v === undefined) return undefined;
    const s = String(v ?? "").trim();

    return s.length > 0 ? s.slice(0, maxLen) : null;
  }

  function parseBool(v: unknown): boolean | undefined {
    if (v === undefined) return undefined;

    return v === true || v === "true" || v === 1;
  }

  function parseIntField(v: unknown): number | null | undefined {
    if (v === undefined) return undefined;
    const n = Number(v);

    return Number.isInteger(n) && n > 0 ? n : null;
  }

  function parseDecimalField(v: unknown): string | null | undefined {
    if (v === undefined) return undefined;
    const n = Number(v);

    return Number.isFinite(n) && n > 0 ? String(n) : null;
  }

  const updates: Partial<typeof moldingTemplates.$inferInsert> = {
    updatedAt: new Date(),
  };

  const strFields80 = [
    "garmentType",
    "garmentSubtype",
    "sesgoType",
    "sesgoColor",
    "hiladillaColor",
    "sleeveType",
    "cuffType",
    "cuffMaterial",
    "zipperLocation",
    "zipperColor",
    "cordColor",
    "liningType",
    "liningColor",
    "hoodType",
    "pocketZipperColor",
    "lateralMeshColor",
    "buttonType",
    "buttonholeType",
    "perillaColor",
    "collarType",
    "invisibleZipperColor",
  ] as const;

  const strFields100 = [
    "fabric",
    "color",
    "process",
    "manufacturingId",
    "neckType",
  ] as const;
  const strFieldsLong = [
    "designDetail",
    "imageUrl",
    "clothingImageOneUrl",
    "clothingImageTwoUrl",
    "logoImageUrl",
    "fusioningNotes",
    "observations",
    "compatibleFabrics",
  ] as const;
  const boolFields = [
    "screenPrint",
    "embroidery",
    "buttonhole",
    "snap",
    "tag",
    "flag",
    "hasElastic",
    "hasInnerLining",
    "hasPocket",
    "hasLateralMesh",
    "hasFajon",
    "hasTanca",
    "hasProtection",
    "hasEntretela",
    "isActive",
  ] as const;

  for (const f of strFields80) {
    const v = parseStr(body[f], 80);

    if (v !== undefined) updates[f] = v;
  }
  for (const f of strFields100) {
    const v = parseStr(body[f], 100);

    if (v !== undefined) updates[f] = v;
  }
  for (const f of strFieldsLong) {
    const v = parseStr(body[f], 2000);

    if (v !== undefined) updates[f] = v;
  }
  for (const f of boolFields) {
    const v = parseBool(body[f]);

    if (v !== undefined) updates[f] = v;
  }

  const gender = parseStr(body.gender, 50);

  if (gender !== undefined) updates.gender = gender;

  const estimatedLeadDays = parseIntField(body.estimatedLeadDays);

  if (estimatedLeadDays !== undefined)
    updates.estimatedLeadDays = estimatedLeadDays;

  const zipperSizeCm = parseDecimalField(body.zipperSizeCm);

  if (zipperSizeCm !== undefined) updates.zipperSizeCm = zipperSizeCm;

  const current = existing[0];
  const finalGarmentType =
    updates.garmentType ?? current.garmentType ?? null;
  const finalGarmentSubtype =
    updates.garmentSubtype ?? current.garmentSubtype ?? null;
  const finalHasTanca = updates.hasTanca ?? current.hasTanca ?? false;
  const finalHasLateralMesh =
    updates.hasLateralMesh ?? current.hasLateralMesh ?? false;
  const finalCordColor =
    updates.cordColor ?? current.cordColor ?? null;
  const finalLateralMeshColor =
    updates.lateralMeshColor ?? current.lateralMeshColor ?? null;
  const isPantaloneta = normalizeUpper(finalGarmentType) === "PANTALONETA";

  if (isPantaloneta) {
    const normalizedSubtype = normalizeUpper(finalGarmentSubtype);

    if (
      !PANTALONETA_SUBTYPE_OPTIONS.some(
        (option) => normalizeUpper(option) === normalizedSubtype,
      )
    ) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "Para PANTALONETA debes seleccionar un subtipo valido.",
        {
          garmentSubtype: [
            "Para PANTALONETA debes seleccionar un subtipo valido.",
          ],
        },
      );
    }

    if (finalHasTanca && !finalCordColor) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "Debes indicar el color de la cuerda.",
        {
          cordColor: ["Debes indicar el color de la cuerda."],
        },
      );
    }

    if (finalHasLateralMesh && !finalLateralMeshColor) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "Debes indicar el color de la malla lateral.",
        {
          lateralMeshColor: ["Debes indicar el color de la malla lateral."],
        },
      );
    }

    updates.neckType = null;
    if (!finalHasTanca) updates.cordColor = null;
    if (!finalHasLateralMesh) updates.lateralMeshColor = null;
  }

  try {
    const updated = await db.transaction(async (tx) => {
      let linkRows: Array<{
        fabricId: string;
        sortOrder: number;
        note: string | null;
      }> = [];

      if (parsedLinks?.success) {
        linkRows = parsedLinks.data.fabricLinks
          ? parsedLinks.data.fabricLinks.map((row, index) => ({
              fabricId: row.fabricId,
              sortOrder: row.sortOrder ?? index + 1,
              note: row.note ?? null,
            }))
          : (parsedLinks.data.fabricIds ?? []).map((fabricId, index) => ({
              fabricId,
              sortOrder: index + 1,
              note: null,
            }));

        const fabricIds = Array.from(new Set(linkRows.map((row) => row.fabricId)));

        let availableFabrics: Array<{ id: string; name: string | null }> = [];

        if (fabricIds.length > 0) {
          availableFabrics = await tx
            .select({ id: fabrics.id, name: fabrics.name })
            .from(fabrics)
            .where(inArray(fabrics.id, fabricIds));

          const availableSet = new Set(availableFabrics.map((row) => row.id));
          const invalidIds = fabricIds.filter(
            (fabricId) => !availableSet.has(fabricId),
          );

          if (invalidIds.length > 0) {
            throw new Error(`INVALID_FABRIC_IDS:${invalidIds.join(",")}`);
          }

          const nameById = new Map(
            availableFabrics.map((row) => [row.id, String(row.name ?? "")]),
          );
          const snapshot = linkRows
            .map((row) => nameById.get(row.fabricId) ?? "")
            .filter(Boolean)
            .join(", ");

          updates.compatibleFabrics = snapshot || null;
        } else {
          updates.compatibleFabrics = null;
        }

        await tx
          .delete(moldingTemplateFabrics)
          .where(eq(moldingTemplateFabrics.moldingTemplateId, id));

        if (linkRows.length > 0) {
          await tx.insert(moldingTemplateFabrics).values(
            linkRows.map((row, index) => ({
              moldingTemplateId: id,
              fabricId: row.fabricId,
              sortOrder: row.sortOrder ?? index + 1,
              note: row.note ?? null,
            })),
          );
        }
      }

      const [updatedTemplate] = await tx
        .update(moldingTemplates)
        .set(updates)
        .where(eq(moldingTemplates.id, id))
        .returning();

      const links = await listTemplateCompatibleFabrics({
        dbOrTx: tx,
        moldingTemplateId: id,
      });

      return { ...updatedTemplate, fabrics: links };
    });

    return Response.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("INVALID_FABRIC_IDS:")) {
      return jsonError(
        422,
        "FABRIC_NOT_FOUND",
        "Una o mas telas no existen en el catalogo.",
        {
          fabricIds: [error.message.replace("INVALID_FABRIC_IDS:", "")],
        },
      );
    }

    const response = dbErrorResponse(error);

    if (response) return response;

    return jsonError(
      500,
      "MOLDING_TEMPLATE_UPDATE_FAILED",
      "No se pudo actualizar la molderia.",
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "molding-templates-id:delete",
    limit: 15,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_MOLDERIA");

  if (forbidden) return forbidden;

  const { id } = await params;

  try {
    const [deleted] = await db
      .update(moldingTemplates)
      .set({ isActive: false, deprecatedAt: new Date() })
      .where(eq(moldingTemplates.id, id))
      .returning({ id: moldingTemplates.id });

    if (!deleted) {
      return jsonError(404, "MOLDING_TEMPLATE_NOT_FOUND", "Molderia no encontrada.");
    }

    return Response.json({ success: true });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return jsonError(
      500,
      "MOLDING_TEMPLATE_DELETE_FAILED",
      "No se pudo eliminar la molderia.",
    );
  }
}
