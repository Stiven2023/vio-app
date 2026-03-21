"use client";

import React, { useEffect, useState } from "react";
import { Card, CardBody, Chip, Skeleton } from "@heroui/react";
import { MdBlock, MdCheckCircle } from "react-icons/md";

type LegalStatusResult = {
  clientId: string;
  isLegallyEnabled: boolean;
  legalNotes: string | null;
};

type DespachoLegalStatusAlertProps = {
  /** The order's client ID to check legal status for */
  clientId: string | null;
};

/**
 * Checks the client's legal status before allowing dispatch actions.
 * Shows a blocking alert if the client is legally disabled.
 */
export function DespachoLegalStatusAlert({
  clientId,
}: DespachoLegalStatusAlertProps) {
  const [status, setStatus] = useState<LegalStatusResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) return;

    let active = true;

    setLoading(true);

    fetch(`/api/mes/client-legal-status/${clientId}`)
      .then((res) => {
        if (!res.ok) {
          // If 403 (not authorized to see legal status), treat as enabled
          return { clientId, isLegallyEnabled: true, legalNotes: null };
        }

        return res.json();
      })
      .then((data: LegalStatusResult) => {
        if (!active) return;
        setStatus(data);
      })
      .catch(() => {
        if (!active) return;
        // On error, treat as enabled (don't block)
        setStatus({
          clientId: clientId ?? "",
          isLegallyEnabled: true,
          legalNotes: null,
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [clientId]);

  if (!clientId) return null;

  if (loading) {
    return <Skeleton className="h-10 w-full rounded-medium" />;
  }

  if (!status) return null;

  if (!status.isLegallyEnabled) {
    return (
      <Card
        className="border border-danger-300 bg-danger-50"
        radius="sm"
        shadow="none"
      >
        <CardBody className="gap-2 py-3 px-4">
          <div className="flex items-center gap-2">
            <MdBlock className="text-danger shrink-0" size={20} />
            <p className="text-sm font-semibold text-danger-800">
              Este cliente no tiene habilitación jurídica vigente
            </p>
          </div>
          <p className="text-xs text-danger-700">
            Contacta al área jurídica para activar su estado. No es posible
            despachar este pedido.
          </p>
          {status.legalNotes && (
            <p className="text-xs text-default-500 mt-1">
              <strong>Nota:</strong> {status.legalNotes}
            </p>
          )}
          <Chip className="mt-1" color="danger" size="sm" variant="flat">
            BLOQUEADO_JURIDICO
          </Chip>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card
      className="border border-success-200 bg-success-50"
      radius="sm"
      shadow="none"
    >
      <CardBody className="flex flex-row items-center gap-2 py-2 px-4">
        <MdCheckCircle className="text-success shrink-0" size={16} />
        <p className="text-xs text-success-700">
          Cliente habilitado jurídicamente para despacho.
        </p>
      </CardBody>
    </Card>
  );
}

/**
 * Returns whether the client is legally enabled (for blocking dispatch button).
 */
export function useClientLegalStatus(clientId: string | null) {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setIsEnabled(true);

      return;
    }

    let active = true;

    setLoading(true);

    fetch(`/api/mes/client-legal-status/${clientId}`)
      .then((res) => {
        if (!res.ok) return { isLegallyEnabled: true };

        return res.json();
      })
      .then((data: { isLegallyEnabled: boolean }) => {
        if (!active) return;
        setIsEnabled(data.isLegallyEnabled ?? true);
      })
      .catch(() => {
        if (!active) return;
        setIsEnabled(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [clientId]);

  return { isEnabled, loading };
}
