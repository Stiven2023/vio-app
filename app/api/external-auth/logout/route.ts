export async function POST() {
  const response = Response.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";

  response.headers.set(
    "Set-Cookie",
    `external_access_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0;${secure ? " Secure;" : ""}`,
  );

  return response;
}
