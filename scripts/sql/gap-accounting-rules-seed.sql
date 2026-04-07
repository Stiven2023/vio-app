INSERT INTO accounting_rule_definitions
  (source_module, source_type, event, description_template,
   debit_account_code, credit_account_code, amount_field, sort_order, is_active)
VALUES
  ('HCM', 'COMISION_VENTA', 'LIQUIDADA',
   'Comision ventas {{period}} asesor {{employeeId}}',
   '5230', '2335', 'comision', 1, true),
  ('VENTAS', 'SURCHARGE_PRIORITARIO', 'APLICADO',
   'Cargo prioridad pedido {{orderCode}} · {{surchargeLabel}}',
   '1305', '4135', 'surchargeAmount', 1, true),
  ('COMPRAS', 'FACTURA_PROVEEDOR', 'RETENCION_FUENTE',
   'RteFte factura proveedor {{invoiceCode}}',
   '2365', '1110', 'rteFuente', 1, true),
  ('COMPRAS', 'FACTURA_PROVEEDOR', 'RETENCION_ICA',
   'RteICA factura proveedor {{invoiceCode}}',
   '2368', '1110', 'rteICA', 2, true),
  ('COMPRAS', 'FACTURA_PROVEEDOR', 'RETENCION_IVA',
   'RteIVA factura proveedor {{invoiceCode}}',
   '2367', '1110', 'rteIVA', 3, true)
ON CONFLICT DO NOTHING;
