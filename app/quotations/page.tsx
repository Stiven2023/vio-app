import { QuotationsList } from "./_components/QuotationsList";

export default function QuotationsPage() {
  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Cotizaciones</h1>
      <p className="text-default-600 mt-1">Consulta y gestiona cotizaciones.</p>
      <div className="mt-6">
        <QuotationsList />
      </div>
    </div>
  );
}
