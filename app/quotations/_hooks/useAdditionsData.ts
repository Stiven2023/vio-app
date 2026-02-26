import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { apiJson, getErrorMessage } from "@/app/catalog/_lib/api";
import type { AdditionOption, Currency } from "../_lib/types";

export function useAdditionsData(currency: Currency) {
  const [additions, setAdditions] = useState<AdditionOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const catalogType = currency === "USD" ? "INTERNACIONAL" : "NACIONAL";

    setLoading(true);
    apiJson<{ additions: AdditionOption[] }>(
      `/api/quotations/options?catalogType=${catalogType}`,
    )
      .then((res) => {
        if (!active) return;
        setAdditions(res.additions ?? []);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(getErrorMessage(error));
        setAdditions([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currency]);

  return { additions, loading };
}
