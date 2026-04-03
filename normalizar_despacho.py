"""
normalizar_despacho.py
======================
Normaliza MATRIZ DE DESPACHO.xlsx a JSON para importar en mes_envios / mes_envio_items.

Uso:
  python normalizar_despacho.py
  python normalizar_despacho.py --input "MATRIZ DE DESPACHO.xlsx" --base datos_despacho_normalizada
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


def make_id() -> str:
    return str(uuid.uuid4())


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


def as_int(value: object) -> int:
    if value is None:
        return 0
    try:
        return max(0, int(float(str(value).replace(",", "."))))
    except Exception:
        return 0


def find_col(columns: list[str], aliases: list[str]) -> str | None:
    col_map = {normalize_text(col): col for col in columns}
    for alias in aliases:
        normalized = normalize_text(alias)
        if normalized in col_map:
            return col_map[normalized]

    for alias in aliases:
        normalized = normalize_text(alias)
        for normalized_col, original_col in col_map.items():
            if normalized in normalized_col:
                return original_col

    return None


def bool_from_value(value: object) -> bool:
    text = normalize_text(value)
    return any(token in text for token in ("SI", "TRUE", "1", "DECLARADO", "ASEGURADO"))


def main(input_path: str, base: str) -> None:
    if not Path(input_path).exists():
        raise FileNotFoundError(f"No existe {input_path}")

    excel = pd.ExcelFile(input_path)
    sheet_name = excel.sheet_names[0]
    df = pd.read_excel(input_path, sheet_name=sheet_name, dtype=str)
    df = df.dropna(how="all")

    if df.empty:
        raise ValueError("El archivo no contiene filas de datos")

    columns = list(df.columns)

    c_order = find_col(columns, ["pedido", "order", "orden", "order_code"])
    c_origen = find_col(columns, ["origen", "area origen"])
    c_destino = find_col(columns, ["destino", "area destino"])
    c_transport = find_col(columns, ["transporte", "tipo transporte", "transportista"])
    c_status = find_col(columns, ["estado", "status envio"])
    c_payment = find_col(columns, ["estado pago", "pago", "payment status"])
    c_salida = find_col(columns, ["fecha salida", "salida", "fecha envio"])
    c_llegada = find_col(columns, ["fecha llegada", "llegada"])
    c_retorno = find_col(columns, ["fecha retorno", "retorno"])
    c_logistic = find_col(columns, ["operador logistico", "logistic operator"])
    c_address = find_col(columns, ["direccion", "destino direccion"])
    c_declared = find_col(columns, ["valor declarado", "declared value"])
    c_courier = find_col(columns, ["courier", "mensajero", "traido por"])
    c_rec_loc = find_col(columns, ["lugar recepcion", "reception location"])
    c_rec_status = find_col(columns, ["estado recepcion", "reception status"])
    c_obs = find_col(columns, ["observaciones", "obs"])
    c_item_id = find_col(columns, ["order_item_id", "item id", "id diseno"])
    c_diseno = find_col(columns, ["diseno", "diseño"])
    c_qty = find_col(columns, ["cantidad", "qty", "cantidad enviada"])
    c_packed = find_col(columns, ["cantidad empacada", "packed quantity", "qty packed"])

    envios: dict[str, dict] = {}
    envio_items: list[dict] = []

    for _, row in df.iterrows():
        order_code_raw = row[c_order] if c_order else None
        order_code = normalize_text(order_code_raw).replace("  ", " ")
        if not order_code:
            continue

        salida = parse_date(row[c_salida] if c_salida else None)
        destino = str(row[c_destino]).strip() if c_destino else ""
        transport = str(row[c_transport]).strip() if c_transport else ""

        envio_key = "|".join([order_code, salida or "", normalize_text(destino), normalize_text(transport)])

        if envio_key not in envios:
            envios[envio_key] = {
                "id": make_id(),
                "order_code_ref": order_code,
                "origen_area": str(row[c_origen]).strip() if c_origen else "",
                "origen_nombre": str(row[c_origen]).strip() if c_origen else "",
                "destino_area": destino,
                "destino_nombre": destino,
                "transporte_tipo": transport,
                "status": str(row[c_status]).strip() if c_status else "",
                "payment_status": str(row[c_payment]).strip() if c_payment else "",
                "salida_at": salida,
                "llegada_at": parse_date(row[c_llegada] if c_llegada else None),
                "retorno_at": parse_date(row[c_retorno] if c_retorno else None),
                "logistic_operator": str(row[c_logistic]).strip() if c_logistic else "",
                "destination_address": str(row[c_address]).strip() if c_address else "",
                "requires_declared_value": bool_from_value(row[c_declared] if c_declared else None),
                "courier_brought_by": str(row[c_courier]).strip() if c_courier else "",
                "reception_location": str(row[c_rec_loc]).strip() if c_rec_loc else "",
                "reception_status": str(row[c_rec_status]).strip() if c_rec_status else "",
                "observaciones": str(row[c_obs]).strip() if c_obs else "",
            }

        envio_items.append(
            {
                "id": make_id(),
                "envio_id": envios[envio_key]["id"],
                "order_item_id_ref": str(row[c_item_id]).strip() if c_item_id else "",
                "order_code_ref": order_code,
                "diseno_ref": as_int(row[c_diseno] if c_diseno else None) or None,
                "quantity": as_int(row[c_qty] if c_qty else None),
                "packed_quantity": as_int(row[c_packed] if c_packed else None),
                "notes": str(row[c_obs]).strip() if c_obs else "",
            }
        )

    envios_list = list(envios.values())
    out_dir = Path(input_path).resolve().parent

    envios_path = out_dir / f"{base}.envios.json"
    items_path = out_dir / f"{base}.envio_items.json"

    with open(envios_path, "w", encoding="utf-8") as f:
        json.dump(envios_list, f, ensure_ascii=False, indent=2)

    with open(items_path, "w", encoding="utf-8") as f:
        json.dump(envio_items, f, ensure_ascii=False, indent=2)

    print(f"✅ Envios: {len(envios_list)} -> {envios_path.name}")
    print(f"✅ Envio items: {len(envio_items)} -> {items_path.name}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Normaliza matriz de despacho")
    parser.add_argument("--input", default="MATRIZ DE DESPACHO.xlsx")
    parser.add_argument("--base", default="datos_despacho_normalizada")
    args = parser.parse_args()

    main(args.input, args.base)
