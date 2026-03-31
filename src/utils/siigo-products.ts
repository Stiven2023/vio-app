export async function buildSiigoProductPayload(
  product: {
    productCode: string;
    name: string;
    priceCopBase?: string | null;
  },
  accountGroup: number,
) {
  const basePrice = parseFloat(String(product.priceCopBase ?? "0")) || 0;

  return {
    code: product.productCode,
    name: product.name.substring(0, 150),
    account_group: accountGroup,
    type: "Product",
    stock_control: false,
    active: true,
    tax_classification: "Taxed",
    tax_included: false,
    tax_consumption_value: 0,
    prices: [
      {
        currency_code: "COP",
        price_list: [{ position: 1, value: basePrice }],
      },
    ],
  };
}
