"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Skeleton } from "@heroui/skeleton";

export function JuridicaSectionSkeleton({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <Card className="border border-default-200 bg-content1/80">
      <CardHeader className="flex flex-col items-start gap-1 pb-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-default-500">{subtitle}</p>
      </CardHeader>
      <CardBody className="gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, idx) => (
            <div
              key={`juridica-metric-${idx}`}
              className="rounded-large border border-default-100 p-3"
            >
              <Skeleton className="h-3 w-20 rounded-medium" />
              <Skeleton className="mt-3 h-7 w-28 rounded-medium" />
              <Skeleton className="mt-2 h-3 w-24 rounded-medium" />
            </div>
          ))}
        </div>

        <div className="rounded-large border border-default-100 p-3">
          <Skeleton className="h-4 w-44 rounded-medium" />
          <Skeleton className="mt-3 h-64 w-full rounded-large" />
        </div>
      </CardBody>
    </Card>
  );
}
