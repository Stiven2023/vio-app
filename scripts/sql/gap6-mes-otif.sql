CREATE OR REPLACE VIEW v_mes_otif AS
SELECT
  TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS period,
  operation_type AS area,
  COUNT(*) AS total_operaciones,
  SUM(quantity_op) AS planificado,
  SUM(produced_quantity) AS producido,
  ROUND(
    SUM(CASE WHEN is_complete THEN produced_quantity ELSE 0 END)::numeric
    / NULLIF(SUM(quantity_op), 0) * 100,
    2
  ) AS tasa_completado_pct,
  ROUND(
    SUM(CASE WHEN is_complete AND NOT is_partial THEN produced_quantity ELSE 0 END)::numeric
    / NULLIF(SUM(quantity_op), 0) * 100,
    2
  ) AS otif_pct,
  ROUND(
    AVG(EXTRACT(EPOCH FROM (end_at - start_at)) / 3600)::numeric,
    2
  ) AS tiempo_ciclo_hrs_promedio,
  ROUND(
    SUM(CASE WHEN repo_check THEN 1 ELSE 0 END)::numeric
    / NULLIF(COUNT(*), 0) * 100,
    2
  ) AS tasa_reposicion_pct
FROM operative_dashboard_logs
WHERE start_at IS NOT NULL
  AND end_at IS NOT NULL
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

CREATE OR REPLACE VIEW v_mes_throughput_diario AS
SELECT
  DATE(created_at) AS fecha,
  operation_type AS area,
  SUM(produced_quantity) AS producido,
  SUM(quantity_op) AS planificado,
  COUNT(DISTINCT operator_employee_id) AS operarios_activos,
  ROUND(
    SUM(produced_quantity)::numeric
    / NULLIF(COUNT(DISTINCT operator_employee_id), 0),
    1
  ) AS prendas_por_operario
FROM operative_dashboard_logs
WHERE is_complete = true OR is_partial = true
GROUP BY 1, 2
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW v_mes_reposiciones AS
SELECT
  TO_CHAR(DATE_TRUNC('month', odl.created_at), 'YYYY-MM') AS period,
  odl.order_code,
  odl.design_name,
  odl.observations AS causa_reposicion,
  odl.produced_quantity AS cantidad_repuesta,
  oi.unit_price AS precio_unitario,
  odl.produced_quantity * COALESCE(oi.unit_price::numeric, 0) AS costo_estimado_reposicion
FROM operative_dashboard_logs odl
LEFT JOIN orders o ON o.order_code = odl.order_code
LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.name = odl.design_name
WHERE odl.repo_check = true
ORDER BY odl.created_at DESC;
