import { z } from "zod";

import {
  seguimientoOperationTypes,
  seguimientoProcessCodes,
  seguimientoRoleAreas,
} from "@/src/imports/historical-excel/seguimiento";

export const rawEnvioSchema = z.object({
  id: z.string().uuid(),
  order_code_ref: z.string().trim().min(1),
  origen_area: z.string().trim().nullable(),
  origen_nombre: z.string().trim().nullable(),
  destino_area: z.string().trim().nullable(),
  destino_nombre: z.string().trim().nullable(),
  transporte_tipo: z.string().trim().nullable(),
  status: z.string().trim().nullable(),
  payment_status: z.string().trim().nullable(),
  salida_at: z.string().trim().nullable(),
  llegada_at: z.string().trim().nullable(),
  retorno_at: z.string().trim().nullable(),
  logistic_operator: z.string().trim().nullable(),
  destination_address: z.string().trim().nullable(),
  requires_declared_value: z.boolean().nullable(),
  courier_brought_by: z.string().trim().nullable(),
  reception_location: z.string().trim().nullable(),
  reception_status: z.string().trim().nullable(),
  observaciones: z.string().trim().nullable(),
});

export const rawEnvioItemSchema = z.object({
  id: z.string().uuid(),
  envio_id: z.string().uuid(),
  order_item_id_ref: z.string().trim().nullable(),
  order_code_ref: z.string().trim().nullable(),
  diseno_ref: z.number().int().nullable(),
  quantity: z.number().int().nullable(),
  packed_quantity: z.number().int().nullable(),
  notes: z.string().trim().nullable(),
});

export const rawVentaSchema = z.object({
  order_code_ref: z.string().trim().min(1),
  total: z.union([z.string(), z.number()]).nullable(),
  subtotal: z.union([z.string(), z.number()]).nullable(),
  paid_at: z.string().trim().nullable(),
  payment_status: z.string().trim().nullable(),
  client_name: z.string().trim().nullable(),
  invoice_number: z.string().trim().nullable(),
});

export const rawSeguimientoOrderSchema = z.object({
  id: z.string().uuid(),
  order_code: z.string().trim().min(1),
  created_at: z.string().trim().nullable(),
  delivery_date: z.string().trim().nullable(),
  kind: z.string().trim().nullable(),
  status: z.string().trim().nullable(),
  total: z.string().trim().nullable(),
  currency: z.string().trim().nullable(),
});

export const rawSeguimientoOrderItemSchema = z.object({
  id: z.string().uuid(),
  order_id_ref: z.string().trim().nullable().optional(),
  order_code_ref: z.string().trim().min(1),
  diseno_numero: z.number().int(),
  name: z.string().trim().nullable(),
  garment_type: z.string().trim().nullable(),
  fabric: z.string().trim().nullable(),
  gender: z.string().trim().nullable(),
  quantity: z.number().int(),
  estimated_lead_days: z.number().int().nullable(),
  status: z.string().trim().nullable(),
});

export const rawSeguimientoPackagingSchema = z.object({
  id: z.string().uuid(),
  order_item_id: z.string().uuid(),
  size: z.string().trim().nullable(),
  quantity: z.number().int().nullable(),
  mode: z.string().trim().nullable(),
});

export const rawSeguimientoLogSchema = z.object({
  id: z.string().uuid(),
  order_item_id: z.string().uuid(),
  order_code: z.string().trim().min(1),
  design_name: z.string().trim().min(1),
  role_area: z.enum(seguimientoRoleAreas).nullable(),
  operation_type: z.enum(seguimientoOperationTypes).nullable(),
  process_code: z.enum(seguimientoProcessCodes),
  size: z.string().trim().nullable(),
  quantity_op: z.number().int().nullable(),
  produced_quantity: z.number().int().nullable(),
  start_at: z.string().trim().nullable(),
  end_at: z.string().trim().nullable(),
  is_complete: z.boolean().nullable(),
  is_partial: z.boolean().nullable(),
  observations: z.string().trim().nullable(),
  repo_check: z.boolean().nullable(),
});

export type RawEnvio = z.infer<typeof rawEnvioSchema>;
export type RawEnvioItem = z.infer<typeof rawEnvioItemSchema>;
export type RawVenta = z.infer<typeof rawVentaSchema>;
export type RawSeguimientoOrder = z.infer<typeof rawSeguimientoOrderSchema>;
export type RawSeguimientoOrderItem = z.infer<typeof rawSeguimientoOrderItemSchema>;
export type RawSeguimientoPackaging = z.infer<typeof rawSeguimientoPackagingSchema>;
export type RawSeguimientoLog = z.infer<typeof rawSeguimientoLogSchema>;