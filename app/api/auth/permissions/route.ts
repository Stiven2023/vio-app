import { NextResponse } from "next/server";

import { getAuthFromRequest } from "@/src/utils/auth-middleware";
import { requirePermission } from "@/src/utils/permission-middleware";

export async function GET(request: Request) {
  const payload = getAuthFromRequest(request);

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const raw = String(searchParams.get("names") ?? "").trim();

  if (!raw) {
    return NextResponse.json({ permissions: {} });
  }

  const names = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const result: Record<string, boolean> = {};

  for (const name of names) {
    const forbidden = await requirePermission(request, name);

    result[name] = !forbidden;
  }

  return NextResponse.json({ permissions: result });
}
