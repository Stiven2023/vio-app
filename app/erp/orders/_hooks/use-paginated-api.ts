"use client";

import type { Paginated } from "../_lib/types";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { apiJson, getErrorMessage } from "../_lib/api";

export function usePaginatedApi<T>(endpoint: string, pageSize: number) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((v) => v + 1), []);

  useEffect(() => {
    let active = true;

    setLoading(true);
    const joiner = endpoint.includes("?") ? "&" : "?";

    apiJson<Paginated<T>>(
      `${endpoint}${joiner}page=${page}&pageSize=${pageSize}`,
    )
      .then((res) => {
        if (active) setData(res);
      })
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [endpoint, page, pageSize, reloadKey]);

  return { data, loading, page, setPage, refresh };
}
