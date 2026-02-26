import { QuotationEditor } from "../_components/QuotationEditor";

export default async function EditQuotationPage(
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  return <QuotationEditor quoteId={params.id} />;
}
