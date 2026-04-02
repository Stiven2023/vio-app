import { and, desc, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { employees, moldingTemplates } from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "molding-templates:get",
    limit: 150,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MOLDERIA");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim() ?? "";
    const garmentType = searchParams.get("garmentType")?.trim() ?? "";
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const conditions = [];

    if (activeOnly) conditions.push(eq(moldingTemplates.isActive, true));
    if (search) {
      conditions.push(ilike(moldingTemplates.moldingCode, `%${search}%`));
    }
    if (garmentType) {
      conditions.push(eq(moldingTemplates.garmentType, garmentType));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(moldingTemplates)
      .where(where);

    const items = await db
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
        process: moldingTemplates.process,
        estimatedLeadDays: moldingTemplates.estimatedLeadDays,
        isActive: moldingTemplates.isActive,
        createdAt: moldingTemplates.createdAt,
        createdByName: employees.name,
      })
      .from(moldingTemplates)
      .leftJoin(employees, eq(moldingTemplates.createdBy, employees.id))
      .where(where)
      .orderBy(desc(moldingTemplates.createdAt))
      .limit(pageSize)
      .offset(offset);

    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("Could not retrieve molding templates", {
      status: 500,
    });
  }
}

type CreateMoldingTemplateBody = {
  moldingCode?: unknown;
  version?: unknown;
  garmentType?: unknown;
  garmentSubtype?: unknown;
  designDetail?: unknown;
  fabric?: unknown;
  color?: unknown;
  gender?: unknown;
  imageUrl?: unknown;
  clothingImageOneUrl?: unknown;
  clothingImageTwoUrl?: unknown;
  logoImageUrl?: unknown;
  process?: unknown;
  estimatedLeadDays?: unknown;
  manufacturingId?: unknown;
  screenPrint?: unknown;
  embroidery?: unknown;
  buttonhole?: unknown;
  snap?: unknown;
  tag?: unknown;
  flag?: unknown;
  neckType?: unknown;
  sesgoType?: unknown;
  sesgoColor?: unknown;
  hiladillaColor?: unknown;
  sleeveType?: unknown;
  cuffType?: unknown;
  cuffMaterial?: unknown;
  zipperLocation?: unknown;
  zipperColor?: unknown;
  zipperSizeCm?: unknown;
  cordColor?: unknown;
  hasElastic?: unknown;
  liningType?: unknown;
  liningColor?: unknown;
  hoodType?: unknown;
  hasInnerLining?: unknown;
  hasPocket?: unknown;
  pocketZipperColor?: unknown;
  hasLateralMesh?: unknown;
  lateralMeshColor?: unknown;
  hasFajon?: unknown;
  hasTanca?: unknown;
  hasProtection?: unknown;
  buttonType?: unknown;
  buttonholeType?: unknown;
  perillaColor?: unknown;
  collarType?: unknown;
  fusioningNotes?: unknown;
  hasEntretela?: unknown;
  invisibleZipperColor?: unknown;
  observations?: unknown;
  compatibleFabrics?: unknown;
};

function parseStr(v: unknown, maxLen = 255): string | null {
  const s = String(v ?? "").trim();

  return s.length > 0 ? s.slice(0, maxLen) : null;
}

function parseBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

function parseIntField(v: unknown): number | null {
  const n = Number(v);

  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseDecimalField(v: unknown): string | null {
  const n = Number(v);

  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

async function generateMoldingCode(version: number): Promise<string> {
  const rows = await db
    .select({ moldingCode: moldingTemplates.moldingCode })
    .from(moldingTemplates)
    .where(ilike(moldingTemplates.moldingCode, "MOL-%"));

  let maxNumeric = 0;

  for (const row of rows) {
    const code = String(row.moldingCode ?? "").trim();
    const match = code.match(/(\d+)$/);

    if (!match) continue;
    const n = Number(match[1]);

    if (Number.isInteger(n) && n > maxNumeric) {
      maxNumeric = n;
    }
  }

  let nextNumeric = maxNumeric + 1;

  while (true) {
    const candidate = `MOL-${String(nextNumeric).padStart(4, "0")}`;
    const existing = await db
      .select({ id: moldingTemplates.id })
      .from(moldingTemplates)
      .where(
        and(
          eq(moldingTemplates.moldingCode, candidate),
          eq(moldingTemplates.version, version),
        ),
      )
      .limit(1);

    if (existing.length === 0) return candidate;

    nextNumeric += 1;
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "molding-templates:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_MOLDERIA");

  if (forbidden) return forbidden;

  const employeeId = await getEmployeeIdFromRequest(request);

  let body: CreateMoldingTemplateBody;

  try {
    body = (await request.json()) as CreateMoldingTemplateBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const version = parseIntField(body.version) ?? 1;
  let moldingCode = parseStr(body.moldingCode, 50);

  if (!moldingCode) {
    moldingCode = await generateMoldingCode(version);
  }

  // Check unique constraint
  const existing = await db
    .select({ id: moldingTemplates.id })
    .from(moldingTemplates)
    .where(
      and(
        eq(moldingTemplates.moldingCode, moldingCode),
        eq(moldingTemplates.version, version),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return new Response(
      `Molding code '${moldingCode}' version ${version} already exists`,
      { status: 409 },
    );
  }

  try {
    const [created] = await db
      .insert(moldingTemplates)
      .values({
        moldingCode,
        version,
        garmentType: parseStr(body.garmentType, 80),
        garmentSubtype: parseStr(body.garmentSubtype, 80),
        designDetail: parseStr(body.designDetail),
        fabric: parseStr(body.fabric, 100),
        color: parseStr(body.color, 100),
        gender: parseStr(body.gender, 50),
        imageUrl: parseStr(body.imageUrl, 2000),
        clothingImageOneUrl: parseStr(body.clothingImageOneUrl, 2000),
        clothingImageTwoUrl: parseStr(body.clothingImageTwoUrl, 2000),
        logoImageUrl: parseStr(body.logoImageUrl, 2000),
        process: parseStr(body.process, 100),
        estimatedLeadDays: parseIntField(body.estimatedLeadDays),
        manufacturingId: parseStr(body.manufacturingId, 100),
        screenPrint: parseBool(body.screenPrint),
        embroidery: parseBool(body.embroidery),
        buttonhole: parseBool(body.buttonhole),
        snap: parseBool(body.snap),
        tag: parseBool(body.tag),
        flag: parseBool(body.flag),
        neckType: parseStr(body.neckType, 100),
        sesgoType: parseStr(body.sesgoType, 80),
        sesgoColor: parseStr(body.sesgoColor, 80),
        hiladillaColor: parseStr(body.hiladillaColor, 80),
        sleeveType: parseStr(body.sleeveType, 80),
        cuffType: parseStr(body.cuffType, 80),
        cuffMaterial: parseStr(body.cuffMaterial, 80),
        zipperLocation: parseStr(body.zipperLocation, 80),
        zipperColor: parseStr(body.zipperColor, 80),
        zipperSizeCm: parseDecimalField(body.zipperSizeCm),
        cordColor: parseStr(body.cordColor, 80),
        hasElastic: parseBool(body.hasElastic),
        liningType: parseStr(body.liningType, 80),
        liningColor: parseStr(body.liningColor, 80),
        hoodType: parseStr(body.hoodType, 80),
        hasInnerLining: parseBool(body.hasInnerLining),
        hasPocket: parseBool(body.hasPocket),
        pocketZipperColor: parseStr(body.pocketZipperColor, 80),
        hasLateralMesh: parseBool(body.hasLateralMesh),
        lateralMeshColor: parseStr(body.lateralMeshColor, 80),
        hasFajon: parseBool(body.hasFajon),
        hasTanca: parseBool(body.hasTanca),
        hasProtection: parseBool(body.hasProtection),
        buttonType: parseStr(body.buttonType, 80),
        buttonholeType: parseStr(body.buttonholeType, 80),
        perillaColor: parseStr(body.perillaColor, 80),
        collarType: parseStr(body.collarType, 80),
        fusioningNotes: parseStr(body.fusioningNotes, 2000),
        hasEntretela: parseBool(body.hasEntretela),
        invisibleZipperColor: parseStr(body.invisibleZipperColor, 80),
        observations: parseStr(body.observations, 2000),
        compatibleFabrics: parseStr(body.compatibleFabrics, 2000),
        createdBy: employeeId ?? undefined,
        isActive: true,
      })
      .returning();

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("Could not create molding template", { status: 500 });
  }
}
