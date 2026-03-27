import { asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  moldingTemplates,
  orderItemMoldings,
  orderItems,
} from "@/src/db/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderItemId: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-item-moldings:get",
    limit: 150,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MOLDERIA");

  if (forbidden) return forbidden;

  const { orderItemId } = await params;

  try {
    const moldings = await db
      .select()
      .from(orderItemMoldings)
      .where(eq(orderItemMoldings.orderItemId, orderItemId))
      .orderBy(
        asc(orderItemMoldings.combinationOrder),
        desc(orderItemMoldings.createdAt),
      );

    const latestByCombination = new Map<number, (typeof moldings)[number]>();

    for (const molding of moldings) {
      const combinationOrder = Number(molding.combinationOrder ?? 0);

      if (!latestByCombination.has(combinationOrder)) {
        latestByCombination.set(combinationOrder, molding);
      }
    }

    return Response.json({
      items: Array.from(latestByCombination.values()).sort(
        (left, right) => left.combinationOrder - right.combinationOrder,
      ),
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("Could not retrieve order item moldings", {
      status: 500,
    });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orderItemId: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-item-moldings:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_MOLDERIA");

  if (forbidden) return forbidden;

  const { orderItemId } = await params;

  try {
    await db
      .delete(orderItemMoldings)
      .where(eq(orderItemMoldings.orderItemId, orderItemId));

    return Response.json({ ok: true });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("Could not delete order item moldings", {
      status: 500,
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderItemId: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-item-moldings:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_MOLDERIA");

  if (forbidden) return forbidden;

  const { orderItemId } = await params;
  const employeeId = await getEmployeeIdFromRequest(request);

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  // Verify the order item exists
  const [item] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId))
    .limit(1);

  if (!item) {
    return new Response("Order item not found", { status: 404 });
  }

  const moldingTemplateId =
    typeof body.moldingTemplateId === "string" && body.moldingTemplateId.trim()
      ? body.moldingTemplateId.trim()
      : null;

  const overrideGarmentType =
    typeof body.garmentType === "string" && body.garmentType.trim()
      ? body.garmentType.trim().toUpperCase()
      : null;

  const overrideGarmentSubtype =
    typeof body.garmentSubtype === "string" && body.garmentSubtype.trim()
      ? body.garmentSubtype.trim().toUpperCase()
      : null;

  const overrideDesignDetail =
    typeof body.designDetail === "string" && body.designDetail.trim()
      ? body.designDetail.trim()
      : null;

  const overrideImageUrl =
    typeof body.imageUrl === "string" && body.imageUrl.trim()
      ? body.imageUrl.trim()
      : null;

  const imageSlotRaw =
    typeof body.imageSlot === "number"
      ? body.imageSlot
      : Number(String(body.imageSlot ?? ""));

  const imageSlot = imageSlotRaw === 1 || imageSlotRaw === 2 ? imageSlotRaw : null;

  const requestedCombinationOrder =
    typeof body.combinationOrder === "number"
      ? body.combinationOrder
      : Number(String(body.combinationOrder ?? ""));

  // Determine next combination order
  const [{ maxOrder }] = await db
    .select({
      maxOrder: sql<number>`coalesce(max(${orderItemMoldings.combinationOrder}), 0)`,
    })
    .from(orderItemMoldings)
    .where(eq(orderItemMoldings.orderItemId, orderItemId));

  const combinationOrder =
    Number.isFinite(requestedCombinationOrder) && requestedCombinationOrder > 0
      ? Math.floor(requestedCombinationOrder)
      : (maxOrder ?? 0) + 1;

  // If a template is provided, snapshot its fields
  let templateSnapshot: Record<string, unknown> = {};

  if (moldingTemplateId) {
    const [tmpl] = await db
      .select()
      .from(moldingTemplates)
      .where(eq(moldingTemplates.id, moldingTemplateId))
      .limit(1);

    if (tmpl) {
      templateSnapshot = {
        moldingCode: tmpl.moldingCode,
        version: tmpl.version,
        garmentType: tmpl.garmentType,
        garmentSubtype: tmpl.garmentSubtype,
        designDetail: tmpl.designDetail,
        fabric: tmpl.fabric,
        color: tmpl.color,
        gender: tmpl.gender,
        imageUrl: tmpl.imageUrl,
        clothingImageOneUrl: tmpl.clothingImageOneUrl,
        clothingImageTwoUrl: tmpl.clothingImageTwoUrl,
        logoImageUrl: tmpl.logoImageUrl,
        process: tmpl.process,
        estimatedLeadDays: tmpl.estimatedLeadDays,
        manufacturingId: tmpl.manufacturingId,
        screenPrint: tmpl.screenPrint,
        embroidery: tmpl.embroidery,
        buttonhole: tmpl.buttonhole,
        snap: tmpl.snap,
        tag: tmpl.tag,
        flag: tmpl.flag,
        neckType: tmpl.neckType,
        sesgoType: tmpl.sesgoType,
        sesgoColor: tmpl.sesgoColor,
        hiladillaColor: tmpl.hiladillaColor,
        sleeveType: tmpl.sleeveType,
        cuffType: tmpl.cuffType,
        cuffMaterial: tmpl.cuffMaterial,
        zipperLocation: tmpl.zipperLocation,
        zipperColor: tmpl.zipperColor,
        zipperSizeCm: tmpl.zipperSizeCm,
        cordColor: tmpl.cordColor,
        hasElastic: tmpl.hasElastic,
        liningType: tmpl.liningType,
        liningColor: tmpl.liningColor,
        hoodType: tmpl.hoodType,
        hasInnerLining: tmpl.hasInnerLining,
        hasPocket: tmpl.hasPocket,
        pocketZipperColor: tmpl.pocketZipperColor,
        hasLateralMesh: tmpl.hasLateralMesh,
        lateralMeshColor: tmpl.lateralMeshColor,
        hasFajon: tmpl.hasFajon,
        hasTanca: tmpl.hasTanca,
        hasProtection: tmpl.hasProtection,
        buttonType: tmpl.buttonType,
        buttonholeType: tmpl.buttonholeType,
        perillaColor: tmpl.perillaColor,
        collarType: tmpl.collarType,
        fusioningNotes: tmpl.fusioningNotes,
        hasEntretela: tmpl.hasEntretela,
        invisibleZipperColor: tmpl.invisibleZipperColor,
        observations: tmpl.observations,
      };
    }
  }

  try {
    const overrides: Record<string, unknown> = {};

    if (overrideGarmentType) overrides.garmentType = overrideGarmentType;
    if (overrideGarmentSubtype)
      overrides.garmentSubtype = overrideGarmentSubtype;
    if (overrideDesignDetail) overrides.designDetail = overrideDesignDetail;

    if (overrideImageUrl) {
      overrides.imageUrl = overrideImageUrl;
      if (imageSlot === 1) {
        overrides.clothingImageOneUrl = overrideImageUrl;
      }
      if (imageSlot === 2) {
        overrides.clothingImageTwoUrl = overrideImageUrl;
      }
    }

    const [created] = await db
      .insert(orderItemMoldings)
      .values({
        orderItemId,
        moldingTemplateId,
        combinationOrder,
        assignedBy: employeeId ?? undefined,
        ...templateSnapshot,
        ...overrides,
      })
      .returning();

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("Could not assign molding to order item", {
      status: 500,
    });
  }
}
