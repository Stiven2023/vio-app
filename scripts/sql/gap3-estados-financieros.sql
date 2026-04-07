CREATE OR REPLACE VIEW v_account_balances AS
WITH saldos AS (
  SELECT
    ael.account_id,
    aa.code AS account_code,
    aa.name AS account_name,
    aa.type AS account_type,
    aa.normal_balance,
    aa.account_level,
    aa.parent_code,
    LEFT(aa.code, 1) AS clase,
    ae.period,
    SUM(ael.debit) AS total_debito,
    SUM(ael.credit) AS total_credito,
    CASE aa.normal_balance
      WHEN 'DEBIT' THEN SUM(ael.debit) - SUM(ael.credit)
      WHEN 'CREDIT' THEN SUM(ael.credit) - SUM(ael.debit)
      ELSE 0
    END AS saldo_periodo,
    SUM(
      CASE aa.normal_balance
        WHEN 'DEBIT' THEN ael.debit - ael.credit
        WHEN 'CREDIT' THEN ael.credit - ael.debit
        ELSE 0
      END
    ) OVER (
      PARTITION BY ael.account_id
      ORDER BY ae.period
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS saldo_acumulado
  FROM accounting_entry_lines ael
  JOIN accounting_entries ae ON ae.id = ael.entry_id
  JOIN accounting_accounts aa ON aa.id = ael.account_id
  WHERE ae.status = 'POSTED'
  GROUP BY
    ael.account_id,
    aa.code,
    aa.name,
    aa.type,
    aa.normal_balance,
    aa.account_level,
    aa.parent_code,
    ae.period
)
SELECT * FROM saldos;

CREATE OR REPLACE VIEW v_balance_general AS
SELECT
  ab.period,
  ab.account_code,
  ab.account_name,
  ab.account_type,
  ab.account_level,
  ab.parent_code,
  ab.clase,
  ab.saldo_acumulado AS saldo,
  CASE ab.clase
    WHEN '1' THEN 'ACTIVO'
    WHEN '2' THEN 'PASIVO'
    WHEN '3' THEN 'PATRIMONIO'
    ELSE NULL
  END AS seccion_bg,
  CASE
    WHEN ab.account_code LIKE '11%' THEN 'Efectivo y equivalentes'
    WHEN ab.account_code LIKE '12%' THEN 'Inversiones CP'
    WHEN ab.account_code LIKE '13%' THEN 'Deudores comerciales'
    WHEN ab.account_code LIKE '14%' THEN 'Inventarios'
    WHEN ab.account_code LIKE '15%' THEN 'Propiedad planta y equipo'
    WHEN ab.account_code LIKE '16%' THEN 'Intangibles'
    WHEN ab.account_code LIKE '21%' THEN 'Obligaciones financieras CP'
    WHEN ab.account_code LIKE '23%' THEN 'Cuentas por pagar'
    WHEN ab.account_code LIKE '24%' THEN 'Impuestos por pagar'
    WHEN ab.account_code LIKE '26%' THEN 'Obligaciones laborales'
    WHEN ab.account_code LIKE '31%' THEN 'Capital social'
    WHEN ab.account_code LIKE '37%' THEN 'Resultados del ejercicio'
    ELSE aa.niif_classification
  END AS clasificacion_niif,
  ABS(ab.saldo_acumulado) AS saldo_abs
FROM v_account_balances ab
JOIN accounting_accounts aa ON aa.code = ab.account_code
WHERE ab.clase IN ('1', '2', '3')
  AND aa.is_postable = true
  AND ab.saldo_acumulado <> 0
ORDER BY ab.period, ab.account_code;

CREATE OR REPLACE VIEW v_estado_resultados AS
SELECT
  ab.period,
  ab.account_code,
  ab.account_name,
  ab.account_type,
  ab.account_level,
  ab.parent_code,
  ab.clase,
  ab.saldo_periodo AS saldo,
  ab.total_debito,
  ab.total_credito,
  CASE ab.clase
    WHEN '4' THEN 'INGRESO'
    WHEN '5' THEN 'COSTO_GASTO'
    WHEN '6' THEN 'COSTO_PRODUCCION'
    WHEN '7' THEN 'COSTO_PRODUCCION'
    ELSE NULL
  END AS seccion_pyg,
  CASE
    WHEN ab.account_code LIKE '41%' THEN 'Ingresos operacionales'
    WHEN ab.account_code LIKE '42%' THEN 'Ingresos no operacionales'
    WHEN ab.account_code LIKE '51%' THEN 'Gastos de personal'
    WHEN ab.account_code LIKE '52%' THEN 'Gastos generales'
    WHEN ab.account_code LIKE '53%' THEN 'Depreciaciones'
    WHEN ab.account_code LIKE '54%' THEN 'Amortizaciones'
    WHEN ab.account_code LIKE '61%' THEN 'Costo de ventas'
    WHEN ab.account_code LIKE '72%' THEN 'Costo mano de obra'
    WHEN ab.account_code LIKE '73%' THEN 'Costos indirectos fabricacion'
    ELSE 'Otros'
  END AS linea_pyg,
  CASE ab.clase
    WHEN '4' THEN ab.saldo_periodo
    WHEN '5' THEN -ab.saldo_periodo
    WHEN '6' THEN -ab.saldo_periodo
    WHEN '7' THEN -ab.saldo_periodo
    ELSE 0
  END AS contribucion_utilidad
FROM v_account_balances ab
WHERE ab.clase IN ('4', '5', '6', '7')
  AND ab.saldo_periodo <> 0
ORDER BY ab.period, ab.account_code;

CREATE OR REPLACE VIEW v_flujo_efectivo AS
WITH
utilidad AS (
  SELECT period, SUM(contribucion_utilidad) AS utilidad_neta
  FROM v_estado_resultados
  GROUP BY period
),
efectivo AS (
  SELECT period, SUM(saldo_periodo) AS variacion_efectivo
  FROM v_account_balances
  WHERE clase = '1' AND account_code LIKE '11%'
  GROUP BY period
),
deudores AS (
  SELECT period, -SUM(saldo_periodo) AS variacion_cartera
  FROM v_account_balances
  WHERE clase = '1' AND account_code LIKE '13%'
  GROUP BY period
),
inventarios AS (
  SELECT period, -SUM(saldo_periodo) AS variacion_inventario
  FROM v_account_balances
  WHERE clase = '1' AND account_code LIKE '14%'
  GROUP BY period
),
proveedores AS (
  SELECT period, SUM(saldo_periodo) AS variacion_proveedores
  FROM v_account_balances
  WHERE clase = '2' AND account_code LIKE '23%'
  GROUP BY period
),
laborales AS (
  SELECT period, SUM(saldo_periodo) AS variacion_laborales
  FROM v_account_balances
  WHERE clase = '2' AND account_code LIKE '26%'
  GROUP BY period
)
SELECT
  u.period,
  u.utilidad_neta,
  COALESCE(d.variacion_cartera, 0) AS ajuste_cartera,
  COALESCE(i.variacion_inventario, 0) AS ajuste_inventario,
  COALESCE(p.variacion_proveedores, 0) AS ajuste_proveedores,
  COALESCE(l.variacion_laborales, 0) AS ajuste_laborales,
  u.utilidad_neta
    + COALESCE(d.variacion_cartera, 0)
    + COALESCE(i.variacion_inventario, 0)
    + COALESCE(p.variacion_proveedores, 0)
    + COALESCE(l.variacion_laborales, 0) AS flujo_operacional,
  COALESCE(e.variacion_efectivo, 0) AS variacion_efectivo_total
FROM utilidad u
LEFT JOIN efectivo e ON e.period = u.period
LEFT JOIN deudores d ON d.period = u.period
LEFT JOIN inventarios i ON i.period = u.period
LEFT JOIN proveedores p ON p.period = u.period
LEFT JOIN laborales l ON l.period = u.period
ORDER BY u.period DESC;

CREATE OR REPLACE FUNCTION fn_estados_financieros(p_period varchar(7))
RETURNS json AS $$
DECLARE
  v_bg json;
  v_pyg json;
  v_flujo json;
  v_cuadre numeric;
BEGIN
  SELECT json_agg(row_to_json(r)) INTO v_bg
  FROM (
    SELECT account_code, account_name, seccion_bg, clasificacion_niif, saldo_abs AS saldo
    FROM v_balance_general
    WHERE period = p_period AND saldo_abs > 0
    ORDER BY account_code
  ) r;

  SELECT json_agg(row_to_json(r)) INTO v_pyg
  FROM (
    SELECT account_code, account_name, seccion_pyg, linea_pyg,
           ABS(saldo) AS saldo, contribucion_utilidad
    FROM v_estado_resultados
    WHERE period = p_period
    ORDER BY account_code
  ) r;

  SELECT row_to_json(r) INTO v_flujo
  FROM (
    SELECT *
    FROM v_flujo_efectivo
    WHERE period = p_period
    LIMIT 1
  ) r;

  SELECT
    SUM(CASE clase WHEN '1' THEN saldo ELSE 0 END)
    - SUM(CASE clase WHEN '2' THEN saldo ELSE 0 END)
    - SUM(CASE clase WHEN '3' THEN saldo ELSE 0 END)
  INTO v_cuadre
  FROM v_balance_general
  WHERE period = p_period;

  RETURN json_build_object(
    'period', p_period,
    'generado_en', now(),
    'cuadre_ok', ABS(COALESCE(v_cuadre, 0)) < 0.01,
    'diferencia', COALESCE(v_cuadre, 0),
    'balance_general', v_bg,
    'estado_resultados', v_pyg,
    'flujo_efectivo', v_flujo
  );
END;
$$ LANGUAGE plpgsql;
