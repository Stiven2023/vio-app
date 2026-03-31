import Link from "next/link";

type RetiredPageProps = {
  searchParams?: {
    from?: string | string[];
  };
};

function readFromPath(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";

  return value ?? "";
}

export default function HcmLegacyRetiredPage({ searchParams }: RetiredPageProps) {
  const from = readFromPath(searchParams?.from);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-8 shadow-sm">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-700">
          Ruta descontinuada
        </p>
        <h1 className="text-3xl font-bold text-slate-900">HCM HUMAN CAPITAL MANAGEMENT</h1>
        <p className="mt-4 text-base text-slate-700">
          La ruta anterior de HCM ya fue retirada. Usa las rutas canónicas nuevas para continuar.
        </p>

        {from ? (
          <p className="mt-3 rounded-md bg-white px-3 py-2 text-sm text-slate-600">
            Ruta solicitada: <span className="font-mono">{from}</span>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            href="/hcm"
          >
            Ir a HCM
          </Link>
          <Link
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
            href="/erp/hcm"
          >
            Abrir ERP HCM
          </Link>
          <Link
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
            href="/portal/hcm"
          >
            Abrir Portal HCM
          </Link>
        </div>
      </div>
    </main>
  );
}
