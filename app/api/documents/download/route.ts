import { readFile } from "fs/promises";
import path from "path";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "documents:download",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return new Response("Ruta del documento requerida", { status: 400 });
    }

    // Asegurar que la ruta sea relativa y esté dentro de la carpeta documents
    const sanitizedPath = filePath.replace(/\.\./g, "").replace(/^\/+/, "");
    
    if (!sanitizedPath.startsWith("documents/")) {
      return new Response("Acceso denegado: solo se pueden descargar documentos", {
        status: 403,
      });
    }

    const fullPath = path.join(process.cwd(), "public", sanitizedPath);
    console.log("📥 Intentando descargar:", fullPath);

    const buffer = await readFile(fullPath);
    const fileName = path.basename(fullPath);

    console.log("✅ Documento descargado exitosamente:", fileName);

    return new Response(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("❌ Error descargando documento:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    
    if (errorMessage.includes("ENOENT")) {
      return new Response("Documento no encontrado", { status: 404 });
    }

    return new Response(
      `Error al descargar el documento: ${errorMessage}`,
      { status: 500 }
    );
  }
}
