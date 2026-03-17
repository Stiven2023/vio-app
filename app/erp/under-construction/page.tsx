import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Modulo en construccion",
};

export default async function EnConstruccionPage({
  searchParams,
}: {
  searchParams: Promise<{ modulo?: string; area?: string }>;
}) {
  const params = await searchParams;
  const modulo = String(params.modulo ?? "ERP").toUpperCase();
  const area = String(params.area ?? "seccion").replace(/[-_]/g, " ");

  return (
    <div className="container mx-auto max-w-4xl px-6 pt-16">
      <div className="rounded-2xl border border-warning-200 bg-warning-50 p-8 text-warning-900">
        <h1 className="text-3xl font-bold">{modulo} · Modulo en desarrollo</h1>
        <p className="mt-3 text-base">
          Estamos trabajando en este modulo: <span className="font-semibold">{area}</span>.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link className="rounded-md bg-warning-900 px-4 py-2 text-sm font-semibold text-warning-50" href="/erp">
            Ir a Dashboard ERP
          </Link>
          <Link className="rounded-md border border-warning-300 px-4 py-2 text-sm font-semibold" href="/">
            Volver a modulos
          </Link>
        </div>
      </div>
    </div>
  );
}
