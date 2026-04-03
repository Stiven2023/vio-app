"""
inspect_excel.py
===============
Inspecciona estructura de archivos Excel para definir mapeos de migracion.

Uso:
  python inspect_excel.py
  python inspect_excel.py --files "MATRIZ DE DESPACHO.xlsx" "VENTAS.xlsx"
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def _norm_header(value: object) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().split())


def inspect_file(file_path: Path, sample_rows: int) -> None:
    print(f"\n=== Archivo: {file_path} ===")
    if not file_path.exists():
        print("  !! No existe")
        return

    workbook = pd.ExcelFile(file_path)
    print(f"  Hojas ({len(workbook.sheet_names)}): {', '.join(workbook.sheet_names)}")

    for sheet in workbook.sheet_names:
        print(f"\n  -- Hoja: {sheet}")
        df_raw = pd.read_excel(file_path, sheet_name=sheet, header=None, dtype=str)
        row_count, col_count = df_raw.shape
        print(f"     Dimensiones crudas: filas={row_count}, columnas={col_count}")

        if row_count == 0:
            print("     Hoja vacia")
            continue

        header = [_norm_header(v) for v in df_raw.iloc[0].tolist()]
        print("     Headers (indice -> nombre):")
        for idx, name in enumerate(header):
            label = name if name else "<VACIO>"
            print(f"       [{idx:>2}] {label}")

        df_data = pd.read_excel(file_path, sheet_name=sheet, header=0, dtype=str)
        df_data = df_data.dropna(how="all")
        print(f"     Filas de datos (sin totalmente vacias): {len(df_data)}")

        if len(df_data) == 0:
            continue

        print(f"     Muestra ({min(sample_rows, len(df_data))} filas):")
        sample = df_data.head(sample_rows).fillna("")
        for i, record in enumerate(sample.to_dict(orient="records"), start=1):
            compact = {k: str(v).strip() for k, v in record.items()}
            print(f"       Fila {i}: {compact}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspecciona estructura de excels")
    parser.add_argument(
        "--files",
        nargs="+",
        default=["MATRIZ DE DESPACHO.xlsx", "VENTAS.xlsx"],
        help="Lista de archivos Excel a inspeccionar",
    )
    parser.add_argument(
        "--sample-rows",
        type=int,
        default=3,
        help="Numero de filas de muestra por hoja",
    )
    args = parser.parse_args()

    for file_name in args.files:
        inspect_file(Path(file_name), sample_rows=max(1, args.sample_rows))


if __name__ == "__main__":
    main()
