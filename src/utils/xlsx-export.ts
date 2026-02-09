import * as XLSX from "xlsx";

export function workbookToXlsxResponse(
  workbook: XLSX.WorkBook,
  filename: string,
) {
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function aoaSheet(rows: Array<Array<string | number | null | undefined>>) {
  return XLSX.utils.aoa_to_sheet(rows.map((row) => row.map((cell) => cell ?? "")));
}
