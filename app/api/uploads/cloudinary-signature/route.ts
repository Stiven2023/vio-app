import crypto from "crypto";

import { rateLimit } from "@/src/utils/rate-limit";

function requiredEnv(name: string) {
  const v = process.env[name];

  if (!v) {
    throw new Error(`${name} is not set`);
  }

  return v;
}

function sign(params: Record<string, string>, apiSecret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "cloudinary:signature",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  try {
    const cloudName = requiredEnv("CLOUD_USER");
    const apiKey = requiredEnv("API_KEY");
    const apiSecret = requiredEnv("API_SECRET");

    const body = (await request.json().catch(() => ({}))) as {
      folder?: string;
      public_id?: string;
    };

    const timestamp = Math.floor(Date.now() / 1000);

    const params: Record<string, string> = {
      timestamp: String(timestamp),
    };

    if (body.folder) params.folder = String(body.folder);
    if (body.public_id) params.public_id = String(body.public_id);

    const signature = sign(params, apiSecret);

    return Response.json({ cloudName, apiKey, timestamp, signature, params });
  } catch (e) {
    return new Response((e as Error)?.message ?? "Invalid config", {
      status: 500,
    });
  }
}
