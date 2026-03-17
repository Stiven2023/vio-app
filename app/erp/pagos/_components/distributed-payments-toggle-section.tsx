"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Skeleton } from "@heroui/skeleton";

const DistributedPaymentsPage = dynamic(
  () =>
    import("@/app/erp/abonos/_components/distributed-payments-page").then(
      (mod) => mod.DistributedPaymentsPage,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3 pt-1">
        <Skeleton className="h-10 w-48 rounded-medium" />
        <Skeleton className="h-12 w-full rounded-medium" />
        <Skeleton className="h-12 w-full rounded-medium" />
        <Skeleton className="h-40 w-full rounded-large" />
      </div>
    ),
  },
);

export function DistributedPaymentsToggleSection({
  buttonLabel = "Mostrar abono distribuido",
  description,
  title,
  ...distributedProps
}: {
  title: string;
  description?: string;
  buttonLabel?: string;
  preselectedOrderId?: string;
  preselectedOrderLabel?: string;
  fixedClientId?: string;
  fixedClientName?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{title}</div>
          {description ? (
            <p className="text-xs text-default-500">{description}</p>
          ) : null}
        </div>
        <Button
          variant={isOpen ? "flat" : "solid"}
          onPress={() => setIsOpen((current) => !current)}
        >
          {isOpen ? "Ocultar" : buttonLabel}
        </Button>
      </CardHeader>
      {isOpen ? (
        <CardBody>
          <DistributedPaymentsPage {...distributedProps} />
        </CardBody>
      ) : null}
    </Card>
  );
}