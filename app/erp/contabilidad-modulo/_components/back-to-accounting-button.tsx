import Link from "next/link";

export function BackToAccountingButton() {
  return (
    <Link
      className="inline-flex items-center justify-center rounded-medium border border-default-300 bg-content2 px-4 py-2 text-sm font-medium transition hover:border-primary hover:text-primary"
      href="/erp/contabilidad-modulo"
    >
      Volver a Contabilidad
    </Link>
  );
}
