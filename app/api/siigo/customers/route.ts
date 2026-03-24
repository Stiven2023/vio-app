import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { SiigoApiError, siigoJson } from "@/src/utils/siigo";

type SiigoCustomer = {
  id: string | null;
  name: string;
  identification: string | null;
  email: string | null;
  phone: string | null;
  active: boolean | null;
  type: string | null;
  personType: string | null;
};

type SiigoCustomerPayload = {
  id?: unknown;
  code?: unknown;
  name?: unknown;
  commercial_name?: unknown;
  identification?: unknown;
  email?: unknown;
  active?: unknown;
  type?: unknown;
  person_type?: unknown;
  phones?: unknown;
  phone?: unknown;
};

function toText(value: unknown) {
  const text = String(value ?? "").trim();

  return text || null;
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();

  if (raw === "true") return true;
  if (raw === "false") return false;

  return null;
}

function pickPhone(value: SiigoCustomerPayload) {
  const direct = toText(value.phone);

  if (direct) return direct;

  const phones = Array.isArray(value.phones) ? value.phones : [];

  for (const item of phones) {
    if (item && typeof item === "object") {
      const number = toText((item as { number?: unknown }).number);

      if (number) return number;
    }
  }

  return null;
}

function normalizeCustomer(value: unknown): SiigoCustomer | null {
  if (!value || typeof value !== "object") return null;

  const row = value as SiigoCustomerPayload;
  const name =
    toText(row.name) ?? toText(row.commercial_name) ?? "Cliente sin nombre";

  return {
    id: toText(row.id) ?? toText(row.code),
    name,
    identification: toText(row.identification),
    email: toText(row.email),
    phone: pickPhone(row),
    active: toBoolean(row.active),
    type: toText(row.type),
    personType: toText(row.person_type),
  };
}

function normalizeItems(payload: unknown): {
  items: SiigoCustomer[];
  total: number;
} {
  if (Array.isArray(payload)) {
    const items = payload
      .map(normalizeCustomer)
      .filter((item): item is SiigoCustomer => Boolean(item));

    return { items, total: items.length };
  }

  if (payload && typeof payload === "object") {
    const root = payload as {
      results?: unknown;
      items?: unknown;
      data?: unknown;
      pagination?: { total_results?: unknown; total?: unknown };
      total_results?: unknown;
      total?: unknown;
    };

    const source =
      (Array.isArray(root.results) && root.results) ||
      (Array.isArray(root.items) && root.items) ||
      (Array.isArray(root.data) && root.data) ||
      [];

    const items = source
      .map(normalizeCustomer)
      .filter((item): item is SiigoCustomer => Boolean(item));

    const total = Number(
      root.pagination?.total_results ??
        root.pagination?.total ??
        root.total_results ??
        root.total ??
        items.length,
    );

    return {
      items,
      total: Number.isFinite(total) && total >= 0 ? total : items.length,
    };
  }

  return { items: [], total: 0 };
}

function buildPath(searchParams: URLSearchParams) {
  const allowed = [
    "identification",
    "branch_office",
    "active",
    "type",
    "person_type",
    "created_start",
    "created_end",
    "date_start",
    "date_end",
    "updated_start",
    "updated_end",
    "page",
    "page_size",
  ];

  const sp = new URLSearchParams();

  for (const key of allowed) {
    const value = String(searchParams.get(key) ?? "").trim();

    if (value) sp.set(key, value);
  }

  if (!sp.has("page")) sp.set("page", "1");
  if (!sp.has("page_size")) sp.set("page_size", "10");
  if (!sp.has("active")) sp.set("active", "true");
  if (!sp.has("type")) sp.set("type", "Customer");

  return `/customers?${sp.toString()}`;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "siigo:customers:get",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const path = buildPath(searchParams);
    const payload = await siigoJson<unknown>(path, { method: "GET" });
    const normalized = normalizeItems(payload);

    return Response.json({
      ok: true,
      items: normalized.items,
      total: normalized.total,
      source: path,
    });
  } catch (error) {
    if (error instanceof SiigoApiError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
        },
        { status: error.status },
      );
    }

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo consultar clientes de Siigo",
      },
      { status: 502 },
    );
  }
}
