"use client";

import { Skeleton } from "@heroui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";

type TableSkeletonProps = {
  ariaLabel: string;
  headers: string[];
  rows?: number;
};

function cellWidthClass(colIndex: number) {
  const widths = ["w-44", "w-28", "w-24", "w-24", "w-20", "w-32"];

  return widths[colIndex % widths.length];
}

export function TableSkeleton({
  ariaLabel,
  headers,
  rows = 8,
}: TableSkeletonProps) {
  return (
    <Table aria-label={ariaLabel}>
      <TableHeader>
        {headers.map((h) => (
          <TableColumn key={h}>{h}</TableColumn>
        ))}
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={`sk-${rowIndex}`}>
            {headers.map((h, colIndex) => {
              const isActions = h.toLowerCase().includes("accion");

              return (
                <TableCell key={`${rowIndex}-${h}`}>
                  {isActions ? (
                    <Skeleton className="h-8 w-20 rounded-md" />
                  ) : (
                    <Skeleton
                      className={`h-4 ${cellWidthClass(colIndex)} rounded-md`}
                    />
                  )}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
