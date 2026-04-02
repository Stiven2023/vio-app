import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  orderItemMoldings,
  orderItemPackaging,
  orderItemPositions,
  orderItemSpecialRequirements,
  orderItemTeams,
  orderItems,
  orders,
} from "@/src/db/erp/schema";
import type {
  AppliedMoldingSummary,
  DesignFullView,
  DesignGalleryImage,
  DesignPackagingPerson,
  DesignSizeBreakdown,
  PurchaseHintRequirement,
  PurchaseHintView,
} from "@/src/types/design-overview";

function toNullableString(value: unknown) {
  const text = String(value ?? "").trim();

  return text ? text : null;
}

function toUpperNullableString(value: unknown) {
  const text = toNullableString(value);

  return text ? text.toUpperCase() : null;
}

function toPositiveInt(value: unknown) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) return 0;

  return Math.max(0, Math.floor(number));
}

function pushRequirement(
  requirements: PurchaseHintRequirement[],
  next: PurchaseHintRequirement | null,
) {
  if (!next) return;

  requirements.push(next);
}

function buildSizeBreakdown(
  packagingRows: Array<{
    size: string | null;
    mode: string | null;
    quantity: number | null;
  }>,
) {
  const bySize = new Map<string, { grouped: number; individual: number }>();

  for (const row of packagingRows) {
    const size = toUpperNullableString(row.size);

    if (!size) continue;

    const current = bySize.get(size) ?? { grouped: 0, individual: 0 };
    const quantity = toPositiveInt(row.quantity);
    const mode = toUpperNullableString(row.mode) ?? "AGRUPADO";

    if (mode === "INDIVIDUAL") current.individual += quantity;
    else current.grouped += quantity;

    bySize.set(size, current);
  }

  return Array.from(bySize.entries())
    .map(([size, value]) => {
      const hasGrouped = value.grouped > 0;
      const hasIndividual = value.individual > 0;
      let mode: DesignSizeBreakdown["mode"] = "AGRUPADO";

      if (hasGrouped && hasIndividual) mode = "MIXTO";
      else if (!hasGrouped && hasIndividual) mode = "INDIVIDUAL";

      return {
        size,
        groupedQuantity: value.grouped,
        individualQuantity: value.individual,
        totalQuantity: value.grouped + value.individual,
        mode,
      } satisfies DesignSizeBreakdown;
    })
    .sort((left, right) => left.size.localeCompare(right.size));
}

function latestMoldingByCombination(
  rows: Array<typeof orderItemMoldings.$inferSelect>,
) {
  const byCombination = new Map<number, (typeof rows)[number]>();

  for (const row of rows) {
    const combinationOrder = toPositiveInt(row.combinationOrder) || 1;

    if (!byCombination.has(combinationOrder)) {
      byCombination.set(combinationOrder, row);
    }
  }

  return Array.from(byCombination.values()).sort(
    (left, right) =>
      toPositiveInt(left.combinationOrder) - toPositiveInt(right.combinationOrder),
  );
}

function buildAppliedMoldings(rows: Array<typeof orderItemMoldings.$inferSelect>) {
  return rows.map(
    (row) =>
      ({
        id: row.id,
        combinationOrder: toPositiveInt(row.combinationOrder) || 1,
        moldingTemplateId: row.moldingTemplateId,
        moldingCode: toNullableString(row.moldingCode),
        version: row.version ?? null,
        garmentType: toNullableString(row.garmentType),
        garmentSubtype: toNullableString(row.garmentSubtype),
        fabric: toNullableString(row.fabric),
        color: toNullableString(row.color),
        process: toNullableString(row.process),
        neckType: toNullableString(row.neckType),
        sesgoType: toNullableString(row.sesgoType),
        sesgoColor: toNullableString(row.sesgoColor),
        zipperLocation: toNullableString(row.zipperLocation),
        zipperColor: toNullableString(row.zipperColor),
        zipperSizeCm: toNullableString(row.zipperSizeCm),
        hasProtection: Boolean(row.hasProtection),
        hasEntretela: Boolean(row.hasEntretela),
        hasInnerLining: Boolean(row.hasInnerLining),
        observations: toNullableString(row.observations),
      }) satisfies AppliedMoldingSummary,
  );
}

function buildGalleryImages(args: {
  item: typeof orderItems.$inferSelect;
  teams: Array<typeof orderItemTeams.$inferSelect>;
  moldings: Array<typeof orderItemMoldings.$inferSelect>;
}) {
  const { item, teams, moldings } = args;
  const images: DesignGalleryImage[] = [];
  const seen = new Set<string>();

  const pushImage = (next: DesignGalleryImage | null) => {
    if (!next) return;
    if (seen.has(next.url)) return;
    seen.add(next.url);
    images.push(next);
  };

  pushImage(
    item.clothingImageOneUrl
      ? {
          key: `item-front-${item.id}`,
          label: "Prenda 1",
          url: item.clothingImageOneUrl,
          source: "ORDER_ITEM",
          teamName: null,
        }
      : null,
  );
  pushImage(
    item.clothingImageTwoUrl
      ? {
          key: `item-back-${item.id}`,
          label: "Prenda 2",
          url: item.clothingImageTwoUrl,
          source: "ORDER_ITEM",
          teamName: null,
        }
      : null,
  );
  pushImage(
    item.logoImageUrl
      ? {
          key: `item-logo-${item.id}`,
          label: "Logo",
          url: item.logoImageUrl,
          source: "ORDER_ITEM",
          teamName: null,
        }
      : null,
  );

  for (const team of teams) {
    const teamName = toNullableString(team.name);

    pushImage(
      team.playerImageUrl
        ? {
            key: `team-player-${team.id}`,
            label: `Jugador${teamName ? ` - ${teamName}` : ""}`,
            url: team.playerImageUrl,
            source: "TEAM",
            teamName,
          }
        : null,
    );
    pushImage(
      team.goalkeeperImageUrl
        ? {
            key: `team-goalkeeper-${team.id}`,
            label: `Arquero${teamName ? ` - ${teamName}` : ""}`,
            url: team.goalkeeperImageUrl,
            source: "TEAM",
            teamName,
          }
        : null,
    );
    pushImage(
      team.fullSetImageUrl
        ? {
            key: `team-fullset-${team.id}`,
            label: `Conjunto${teamName ? ` - ${teamName}` : ""}`,
            url: team.fullSetImageUrl,
            source: "TEAM",
            teamName,
          }
        : null,
    );
  }

  for (const molding of moldings) {
    const moldingLabel = toNullableString(molding.moldingCode) ?? "Moldería";

    pushImage(
      molding.clothingImageOneUrl
        ? {
            key: `molding-one-${molding.id}`,
            label: `${moldingLabel} - Imagen 1`,
            url: molding.clothingImageOneUrl,
            source: "MOLDING",
            teamName: null,
          }
        : null,
    );
    pushImage(
      molding.clothingImageTwoUrl
        ? {
            key: `molding-two-${molding.id}`,
            label: `${moldingLabel} - Imagen 2`,
            url: molding.clothingImageTwoUrl,
            source: "MOLDING",
            teamName: null,
          }
        : null,
    );
  }

  return images;
}

function buildPurchaseHints(args: {
  orderCode: string;
  item: typeof orderItems.$inferSelect;
  sizeBreakdown: DesignSizeBreakdown[];
  teams: Array<typeof orderItemTeams.$inferSelect>;
  moldings: Array<typeof orderItemMoldings.$inferSelect>;
  specialRequirements: Array<typeof orderItemSpecialRequirements.$inferSelect>;
}) {
  const { item, moldings, orderCode, sizeBreakdown, specialRequirements, teams } = args;
  const primaryMolding = moldings[0] ?? null;
  const effectiveFabric =
    toNullableString(primaryMolding?.fabric) ?? toNullableString(item.fabric);
  const effectiveColor =
    toNullableString(item.color) ?? toNullableString(primaryMolding?.color);
  const productionTechnique = toUpperNullableString(item.productionTechnique);
  const requirements: PurchaseHintRequirement[] = [];

  pushRequirement(requirements, {
    key: "fabric-base",
    label: "Tela base",
    value: effectiveFabric,
    details: effectiveFabric ? null : "Definir tela base en diseño o moldería.",
    source: primaryMolding?.fabric ? "MOLDING" : "ORDER_ITEM",
    status: effectiveFabric ? "INFO" : "WARNING",
  });

  if (productionTechnique === "SUBLIMACION") {
    pushRequirement(requirements, {
      key: "sublimacion-white-fabric",
      label: "Color de tela requerido",
      value: "BLANCA",
      details: "La sublimación debe salir sobre tela blanca.",
      source: "RULE",
      status: "REQUIRED",
    });
  }

  if (productionTechnique === "FONDO_ENTERO") {
    pushRequirement(requirements, {
      key: "fondo-entero-color",
      label: "Color de tela requerido",
      value: effectiveColor,
      details: effectiveColor
        ? "Fondo entero requiere definir el color de la tela."
        : "Fondo entero marcado sin color de tela definido.",
      source: effectiveColor ? "ORDER_ITEM" : "RULE",
      status: effectiveColor ? "REQUIRED" : "WARNING",
    });
  }

  const technicalPairs: Array<{
    key: string;
    label: string;
    value: string | null;
    details?: string | null;
  }> = [
    {
      key: "neck-type",
      label: "Cuello",
      value: toNullableString(primaryMolding?.neckType) ?? toNullableString(item.neckType),
    },
    {
      key: "cuff-type",
      label: "Puño",
      value: toNullableString(primaryMolding?.cuffType) ?? toNullableString(item.cuffType),
    },
    {
      key: "sesgo",
      label: "Sesgo",
      value: toNullableString(primaryMolding?.sesgoType),
      details: toNullableString(primaryMolding?.sesgoColor),
    },
    {
      key: "zipper",
      label: "Cremallera",
      value: toNullableString(primaryMolding?.zipperLocation),
      details: [
        toNullableString(primaryMolding?.zipperColor),
        toNullableString(primaryMolding?.zipperSizeCm),
      ]
        .filter(Boolean)
        .join(" / ") || null,
    },
    {
      key: "lining",
      label: "Forro",
      value: toNullableString(primaryMolding?.liningType),
      details: toNullableString(primaryMolding?.liningColor),
    },
    {
      key: "garment-subtype",
      label: "Subtipo de prenda",
      value: toNullableString(primaryMolding?.garmentSubtype),
    },
  ];

  for (const pair of technicalPairs) {
    if (!pair.value && !pair.details) continue;

    pushRequirement(requirements, {
      key: pair.key,
      label: pair.label,
      value: pair.value,
      details: pair.details ?? null,
      source: "MOLDING",
      status: "INFO",
    });
  }

  const booleanRequirements: Array<{
    enabled: boolean;
    key: string;
    label: string;
    details: string;
  }> = [
    {
      enabled: Boolean(primaryMolding?.hasProtection),
      key: "has-protection",
      label: "Protección",
      details: "La moldería indica necesidad de material de protección.",
    },
    {
      enabled: Boolean(primaryMolding?.hasEntretela),
      key: "has-entretela",
      label: "Entretela",
      details: "La moldería indica necesidad de entretela.",
    },
    {
      enabled: Boolean(primaryMolding?.hasInnerLining),
      key: "has-inner-lining",
      label: "Forro interno",
      details: "La moldería indica que la prenda lleva forro interno.",
    },
    {
      enabled: Boolean(item.hasCordon) || Boolean(primaryMolding?.cordColor),
      key: "has-cordon",
      label: "Cordón",
      details: toNullableString(item.cordonColor) ?? toNullableString(primaryMolding?.cordColor) ?? "La prenda requiere cordón.",
    },
    {
      enabled: Boolean(item.screenPrint) || Boolean(primaryMolding?.screenPrint),
      key: "screen-print",
      label: "Serigrafía / estampado",
      details: "Confirmar insumo de estampado con producción.",
    },
    {
      enabled: Boolean(item.embroidery) || Boolean(primaryMolding?.embroidery),
      key: "embroidery",
      label: "Bordado",
      details: "Confirmar insumo de bordado con producción.",
    },
  ];

  for (const requirement of booleanRequirements) {
    if (!requirement.enabled) continue;

    pushRequirement(requirements, {
      key: requirement.key,
      label: requirement.label,
      value: "SI",
      details: requirement.details,
      source: requirement.key === "has-cordon" ? "ORDER_ITEM" : "MOLDING",
      status: "REQUIRED",
    });
  }

  for (const row of specialRequirements) {
    const piece = toNullableString(row.piece) ?? "Pieza";
    const details = [
      toNullableString(row.fabric),
      toNullableString(row.fabricColor),
      toNullableString(row.closureType),
      row.closureQuantity ? `${row.closureQuantity} cierres` : null,
      row.hasReflectiveTape ? "Cinta reflectiva" : null,
      toNullableString(row.reflectiveTapeLocation),
      row.hasSideStripes ? "Franjas laterales" : null,
      toNullableString(row.notes),
    ]
      .filter(Boolean)
      .join(" / ");

    pushRequirement(requirements, {
      key: `special-${row.id}`,
      label: `Req. especial ${piece}`,
      value: details || "Configurado",
      details: null,
      source: "SPECIAL_REQUIREMENT",
      status: "REQUIRED",
    });
  }

  const notes = [
    toNullableString(primaryMolding?.observations),
    toNullableString(item.observations),
    teams.length > 1
      ? "Multi-equipo existe en el diseño pero está deshabilitado operativamente."
      : null,
    "Pendiente de parametrización de insumos automáticos.",
  ].filter((value): value is string => Boolean(value));

  return {
    orderId: String(item.orderId ?? ""),
    orderItemId: item.id,
    orderCode,
    designName: toNullableString(item.name) ?? item.id,
    qtyTotal: toPositiveInt(item.quantity),
    sizesBreakdown: sizeBreakdown,
    process: toNullableString(item.process),
    designType: toNullableString(item.designType),
    productionTechnique: toNullableString(item.productionTechnique),
    fabric: effectiveFabric,
    color: effectiveColor,
    garmentType: toNullableString(item.garmentType) ?? toNullableString(primaryMolding?.garmentType),
    garmentSubtype: toNullableString(primaryMolding?.garmentSubtype),
    moldingTemplateCode: toNullableString(primaryMolding?.moldingCode),
    moldingTemplateVersion: primaryMolding?.version ?? null,
    teamsEnabled: false,
    multiTeamDisabled: teams.length > 1,
    teamCount: teams.length,
    pendingInsumosParametrization: true,
    notes,
    requirements,
  } satisfies PurchaseHintView;
}

export async function getDesignFullView(orderItemId: string) {
  const cleanOrderItemId = String(orderItemId ?? "").trim();

  if (!cleanOrderItemId) return null;

  const [itemRows, positions, teams, packagingRows, specialRequirements, moldingRows] =
    await Promise.all([
      db
        .select({
          item: orderItems,
          orderCode: orders.orderCode,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(eq(orderItems.id, cleanOrderItemId))
        .limit(1),
      db
        .select()
        .from(orderItemPositions)
        .where(eq(orderItemPositions.orderItemId, cleanOrderItemId))
        .orderBy(asc(orderItemPositions.sortOrder), asc(orderItemPositions.createdAt)),
      db
        .select()
        .from(orderItemTeams)
        .where(eq(orderItemTeams.orderItemId, cleanOrderItemId))
        .orderBy(asc(orderItemTeams.sortOrder), asc(orderItemTeams.createdAt)),
      db
        .select()
        .from(orderItemPackaging)
        .where(eq(orderItemPackaging.orderItemId, cleanOrderItemId))
        .orderBy(asc(orderItemPackaging.id)),
      db
        .select()
        .from(orderItemSpecialRequirements)
        .where(eq(orderItemSpecialRequirements.orderItemId, cleanOrderItemId))
        .orderBy(asc(orderItemSpecialRequirements.createdAt)),
      db
        .select()
        .from(orderItemMoldings)
        .where(eq(orderItemMoldings.orderItemId, cleanOrderItemId))
        .orderBy(
          asc(orderItemMoldings.combinationOrder),
          desc(orderItemMoldings.createdAt),
        ),
    ]);

  const itemRow = itemRows[0] ?? null;

  if (!itemRow?.item) return null;

  const latestMoldings = latestMoldingByCombination(moldingRows);
  const sizeBreakdown = buildSizeBreakdown(packagingRows);
  const personalized = packagingRows
    .filter((row) => toUpperNullableString(row.mode) === "INDIVIDUAL")
    .map(
      (row) =>
        ({
          size: toUpperNullableString(row.size) ?? "SIN TALLA",
          quantity: toPositiveInt(row.quantity),
          personName: toNullableString(row.personName),
          personNumber: toNullableString(row.personNumber),
          teamId: row.teamId,
          position: toNullableString(row.position),
        }) satisfies DesignPackagingPerson,
    );
  const purchaseHints = buildPurchaseHints({
    orderCode: String(itemRow.orderCode ?? ""),
    item: itemRow.item,
    sizeBreakdown,
    teams,
    moldings: latestMoldings,
    specialRequirements,
  });

  return {
    orderId: String(itemRow.item.orderId ?? ""),
    orderItemId: itemRow.item.id,
    orderCode: String(itemRow.orderCode ?? ""),
    designName: toNullableString(itemRow.item.name) ?? itemRow.item.id,
    quantity: toPositiveInt(itemRow.item.quantity),
    process: toNullableString(itemRow.item.process),
    designType: toNullableString(itemRow.item.designType),
    productionTechnique: toNullableString(itemRow.item.productionTechnique),
    garmentType: toNullableString(itemRow.item.garmentType),
    fabric: toNullableString(itemRow.item.fabric),
    color: toNullableString(itemRow.item.color),
    images: buildGalleryImages({
      item: itemRow.item,
      teams,
      moldings: latestMoldings,
    }),
    teamsEnabled: false,
    teamsDisabledReason:
      teams.length > 0
        ? "Multi-equipo está preservado en el snapshot pero deshabilitado para decisiones operativas."
        : null,
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      playerColor: toNullableString(team.playerColor),
      goalkeeperColor: toNullableString(team.goalkeeperColor),
      socksColor: toNullableString(team.socksColor),
      playerImageUrl: toNullableString(team.playerImageUrl),
      goalkeeperImageUrl: toNullableString(team.goalkeeperImageUrl),
      fullSetImageUrl: toNullableString(team.fullSetImageUrl),
      sortOrder: toPositiveInt(team.sortOrder) || 1,
    })),
    positions: positions.map((row) => ({
      id: row.id,
      position: row.position,
      quantity: toPositiveInt(row.quantity),
      color: toNullableString(row.color),
      sortOrder: toPositiveInt(row.sortOrder) || 1,
    })),
    packaging: {
      sizesBreakdown: sizeBreakdown,
      personalized,
    },
    specialRequirements: specialRequirements.map((row) => ({
      id: row.id,
      piece: toNullableString(row.piece),
      fabric: toNullableString(row.fabric),
      fabricColor: toNullableString(row.fabricColor),
      hasReflectiveTape: Boolean(row.hasReflectiveTape),
      reflectiveTapeLocation: toNullableString(row.reflectiveTapeLocation),
      hasSideStripes: Boolean(row.hasSideStripes),
      notes: toNullableString(row.notes),
    })),
    appliedMoldings: buildAppliedMoldings(latestMoldings),
    purchaseHints,
  } satisfies DesignFullView;
}

export async function listPurchaseHints(limit = 40) {
  const rows = await db
    .select({
      orderItemId: orderItemMoldings.orderItemId,
    })
    .from(orderItemMoldings)
    .orderBy(desc(orderItemMoldings.createdAt));

  const uniqueOrderItemIds = Array.from(
    new Set(rows.map((row) => String(row.orderItemId ?? "").trim()).filter(Boolean)),
  ).slice(0, Math.max(1, Math.floor(limit)));

  const items = await Promise.all(
    uniqueOrderItemIds.map(async (orderItemId) => {
      try {
        const fullView = await getDesignFullView(orderItemId);

        return fullView?.purchaseHints ?? null;
      } catch (error) {
        console.error("Failed to build purchase hints for order item", {
          orderItemId,
          error,
        });
        return null;
      }
    }),
  );

  return items.filter(Boolean) as PurchaseHintView[];
}