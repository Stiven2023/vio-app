import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import * as XLSX from "xlsx";

type CliOptions = {
  file: string;
  out?: string;
  sampleSize: number;
};

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    file: "data/imports/MATRIZ DE DESPACHO.xlsx",
    out: undefined,
    sampleSize: 5,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--file") {
      options.file = argv[index + 1] ?? options.file;
      index += 1;
      continue;
    }

    if (arg === "--out") {
      options.out = argv[index + 1] ?? options.out;
      index += 1;
      continue;
    }

    if (arg === "--sample-size") {
      const parsed = Number(argv[index + 1] ?? options.sampleSize);
      options.sampleSize = Number.isFinite(parsed) && parsed > 0 ? parsed : options.sampleSize;
      index += 1;
    }
  }

  return options;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const workbook = XLSX.readFile(options.file, {
    cellDates: true,
    dense: false,
  });

  const profile = {
    file: path.basename(options.file),
    absoluteFile: path.resolve(options.file),
    sheetCount: workbook.SheetNames.length,
    sheets: workbook.SheetNames.map((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: null,
        raw: true,
      });
      const headers = rows[0] ? Object.keys(rows[0]) : [];

      return {
        sheetName,
        rowCount: rows.length,
        columnCount: headers.length,
        headers,
        sampleRows: rows.slice(0, options.sampleSize),
      };
    }),
  };

  if (options.out) {
    await mkdir(path.dirname(options.out), { recursive: true });
    await writeFile(options.out, JSON.stringify(profile, null, 2), "utf8");
  }

  console.log(JSON.stringify(profile, null, 2));
}

void main();