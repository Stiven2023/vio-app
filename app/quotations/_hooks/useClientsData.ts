import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { apiJson, getErrorMessage } from "@/app/catalog/_lib/api";
import type { ClientOption } from "../_lib/types";

export function useClientsData() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);
    apiJson<{ clients: ClientOption[] }>("/api/quotations/options?catalogType=NACIONAL")
      .then((res) => {
        if (!active) return;
        const activeClients = (res.clients ?? []).filter((client) => Boolean(client.isActive));
        setClients(activeClients);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(getErrorMessage(error));
        setClients([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { clients, loading };
}
