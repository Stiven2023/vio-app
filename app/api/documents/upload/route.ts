import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { rateLimit } from "@/src/utils/rate-limit";

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "documents:upload",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const fileName = formData.get("fileName") as string;
    const uploadFolder = formData.get("uploadFolder") as string;

    if (!file) {
      return new Response("Archivo requerido", { status: 400 });
    }

    if (!fileName) {
      return new Response("Nombre de archivo requerido", { status: 400 });
    }

    // ============================================
    // MODO CLOUDINARY (PRODUCCIÓN - ACTIVO)
    // ============================================

    const cloudName = process.env.CLOUD_USER;
    const apiKey = process.env.API_KEY;
    const apiSecret = process.env.API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      // Fallback a local si Cloudinary no está configurado
      console.warn("⚠️ Cloudinary no configurado, usando almacenamiento local");
      
      const documentsDir = path.join(process.cwd(), "public/documents");
      await mkdir(documentsDir, { recursive: true });

      const filePath = path.join(documentsDir, `${fileName}.pdf`);
      const bytes = await file.arrayBuffer();
      await writeFile(filePath, new Uint8Array(bytes));

      console.log("✅ Documento guardado localmente:", filePath);

      const publicUrl = `/documents/${fileName}.pdf`;
      return Response.json({ url: publicUrl });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string> = {
      timestamp: String(timestamp),
      folder: uploadFolder, // Ej: "clients/1053123456"
      public_id: fileName,  // Ej: "1053123456-ct"
    };

    const toSign = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");

    const signature = crypto
      .createHash("sha1")
      .update(toSign + apiSecret)
      .digest("hex");

    const formDataCloudinary = new FormData();
    formDataCloudinary.append("file", file);
    formDataCloudinary.append("api_key", apiKey);
    Object.entries(params).forEach(([k, v]) => formDataCloudinary.append(k, v));
    formDataCloudinary.append("signature", signature);

    console.log("📤 Enviando a Cloudinary...");
    console.log("📁 Carpeta:", uploadFolder);
    console.log("📝 Archivo:", fileName);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
      {
        method: "POST",
        body: formDataCloudinary,
      }
    );

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      console.error("❌ Cloudinary error:", { status: uploadRes.status, errorText });
      return new Response(`Error al subir a Cloudinary: ${uploadRes.status}`, {
        status: 500,
      });
    }

    const json = (await uploadRes.json()) as { secure_url?: string };

    if (!json.secure_url) {
      return new Response("Cloudinary no devolvió URL", { status: 500 });
    }

    console.log("✅ Documento subido a Cloudinary:", json.secure_url);
    console.log("📁 Carpeta:", uploadFolder);

    return Response.json({ url: json.secure_url });
  } catch (error) {
    console.error("❌ Error guardando documento:", error);
    return new Response(
      `Error al guardar el documento: ${error instanceof Error ? error.message : "Error desconocido"}`,
      { status: 500 }
    );
  }
}
