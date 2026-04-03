"""
normalizar_ventas.py
====================
Normaliza VENTAS.xlsx a JSON para actualizar montos de pedidos.

Uso:
  python normalizar_ventas.py
  python normalizar_ventas.py --input "VENTAS.xlsx" --base datos_ventas_normalizada
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
import uuid
from datetime import date, datetime
from pathlib import Path

import pandas as pd


def normalize_text(value: object) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"\s+", " ", text)
    return text.upper()


def parse_date(value: object) -> str | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()

    text = str(value).strip()
    if not text:
        return None

    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except Exception:
            pass

    try:
        return pd.to_datetime(text, dayfirst=True).date().isoformat()
    except Exception:
        return None


def parse_amount(value: object) -> str | None:
    if value is None:
        return None

    text = str(value).strip()
    if not text:
        return None

    normalized = text.replace(".", "").replace(",", ".")
    normalized = re.sub(r"[^0-9.-]", "", normalized)
    if not normalized:
        return None

    try:
        amount = float(normalized)
    except Exception:
        return None

    return f"{amount:.2f}"


def find_col(columns: list[str], aliases: list[str]) -> str | None:
    normalized_map = {normalize_text(col): col for col in columns}

    for alias in aliases:
        target = normalize_text(alias)
        if target in normalized_map:
            return normalized_map[target]

    for alias in aliases:
        target = normalize_text(alias)
        for normalized_col, original_col in normalized_map.items():
            if target in normalized_col:
                return original_col

    return None


def extract_order_code(value: object) -> str | None:
    text = normalize_text(value)
    if not text:
        return None

    match = re.search(r"\b(VN|VT|VI|VW|VR|VP)\s*-\s*\d+\b", text)
    if match:
        return re.sub(r"\s*-\s*", " - ", match.group(0))

    if text.startswith(("VN", "VT", "VI", "VW", "VR", "VP")):
        cleaned = re.sub(r"\s*-\s*", " - ", text)
        return cleaned

    return None


def main(input_path: str, base: str) -> None:
    if not Path(input_path).exists():
        raise FileNotFoundError(f"No existe {input_path}")

    workbook = pd.ExcelFile(input_path)
    sheet_name = workbook.sheet_names[0]
    df = pd.read_excel(input_path, sheet_name=sheet_name, dtype=str)
    df = df.dropna(how="all")

    if df.empty:
        raise ValueError("No hay filas de datos en VENTAS.xlsx")

    columns = list(df.columns)

    c_order = find_col(columns, ["pedido", "orden", "order_code", "codigo pedido", "doc"])
    c_total = find_col(columns, ["total", "valor total", "monto", "venta"])
    c_subtotal = find_col(columns, ["subtotal", "base"])
    c_paid_at = find_col(columns, ["fecha pago", "fecha", "paid_at"])
    c_payment_status = find_col(columns, ["estado pago", "payment status", "estado"])
    c_client = find_col(columns, ["cliente", "razon social"])
    c_invoice = find_col(columns, ["factura", "invoice", "numero factura"])

    rows: list[dict] = []
    seen: set[str] = set()

    for _, row in df.iterrows():
        order_code = extract_order_code(row[c_order] if c_order else None)
        if not order_code:
            continue

        total = parse_amount(row[c_total] if c_total else None)
        key = f"{order_code}|{total or ''}"
        if key in seen:
            continue
        seen.add(key)

        rows.append(
            {
                "id": str(uuid.uuid4()),
                "order_code_ref": order_code,
                "total": total,
                "subtotal": parse_amount(row[c_subtotal] if c_subtotal else None),
                "paid_at": parse_date(row[c_paid_at] if c_paid_at else None),
                "payment_status": str(row[c_payment_status]).strip() if c_payment_status else "",
                "client_name": str(row[c_client]).strip() if c_client else "",
                "invoice_number": str(row[c_invoice]).strip() if c_invoice else "",
            }
        )

    out_dir = Path(input_path).resolve().parent
    output_path = out_dir / f"{base}.ventas.json"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    print(f"✅ Ventas normalizadas: {len(rows)} -> {output_path.name}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Normaliza ventas")
    parser.add_argument("--input", default="VENTAS.xlsx")
    parser.add_argument("--base", default="datos_ventas_normalizada")
    args = parser.parse_args()

    main(args.input, args.base)
