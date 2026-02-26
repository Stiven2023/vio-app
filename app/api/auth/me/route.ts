import { NextResponse } from "next/server";

import { getAuthFromRequest } from "@/src/utils/auth-middleware";

export async function GET(request: Request) {
  const payload = getAuthFromRequest(request);

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = {
    id: (payload as any).userId ?? null,
    name: (payload as any).name ?? null,
    role: (payload as any).role ?? null,
  };

  return NextResponse.json({ user });
}
