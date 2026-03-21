"use client";

import type { TallaRow } from "@/app/mes/_components/mes-types";

import React from "react";
import { Button } from "@heroui/react";
import * as XLSX from "xlsx";
import { MdDownload } from "react-icons/md";

type MontajeExcelDownloadProps = {
  orderCode: string;
  designName: string;
  tallas: TallaRow[];
};

/**
 * Generates and downloads an Excel file (.xlsx) for the Montaje process.
 * Columns: Número, Nombre del diseño, Talla, Cantidad
 */
export function MontajeExcelDownload({
  orderCode,
  designName,
  tallas,
}: MontajeExcelDownloadProps) {
  const handleDownload = () => {
    const headers = ["Número", "Nombre del diseño", "Talla", "Cantidad"];

    const rows = tallas.map((t, idx) => [
      idx + 1,
      designName,
      t.talla,
      t.cantidad,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Column widths
    worksheet["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 10 }, { wch: 12 }];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Montaje");

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `Montaje_${orderCode}_${today}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  if (tallas.length === 0) return null;

  return (
    <Button
      color="success"
      radius="sm"
      size="sm"
      startContent={<MdDownload />}
      variant="flat"
      onPress={handleDownload}
    >
      Descargar Excel
    </Button>
  );
}
