import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { apiJson, getErrorMessage } from "@/app/catalog/_lib/api";
import type { Currency, ProductOption } from "../_lib/types";

export function useProductsData(currency: Currency) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const catalogType = currency === "USD" ? "INTERNACIONAL" : "NACIONAL";

    setLoading(true);
    apiJson<{ products: ProductOption[] }>(
      `/api/quotations/options?catalogType=${catalogType}`,
    )
      .then((res) => {
        if (!active) return;
        setProducts(res.products ?? []);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(getErrorMessage(error));
        setProducts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currency]);

  return { products, loading };
}
