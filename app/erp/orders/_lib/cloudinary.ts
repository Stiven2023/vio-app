"use client";

import { apiJson } from "./api";

export async function uploadToCloudinary(options: {
  file: File;
  folder: string;
}): Promise<string> {
  const sig = await apiJson<{
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    params: Record<string, string>;
  }>("/api/uploads/cloudinary-signature", {
    method: "POST",
    body: JSON.stringify({ folder: options.folder }),
  });

  const formData = new FormData();

  formData.append("file", options.file);
  formData.append("api_key", sig.apiKey);
  formData.append("timestamp", String(sig.timestamp));
  formData.append("signature", sig.signature);
  Object.entries(sig.params ?? {}).forEach(([k, v]) => formData.append(k, v));

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "");

    throw new Error(text || `Upload failed (${uploadRes.status})`);
  }

  const json = (await uploadRes.json()) as { secure_url?: string };

  if (!json.secure_url) throw new Error("Cloudinary no devolvió secure_url");

  return json.secure_url;
}
