import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.headers.set(
    "Set-Cookie",
    "auth_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
  );

  return response;
}
