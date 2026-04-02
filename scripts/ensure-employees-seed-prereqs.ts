import "dotenv/config";

import { Client } from "pg";

async function ensureEmployeesSeedPrereqs() {
  const erpUrl = process.env.ERP_DATABASE_URL;

  if (!erpUrl) {
    throw new Error("ERP_DATABASE_URL missing");
  }

  const client = new Client({ connectionString: erpUrl });
  await client.connect();

  await client.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'identification_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.identification_type AS ENUM (
      'CC',
      'NIT',
      'CE',
      'PAS',
      'EMPRESA_EXTERIOR'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'contract_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.contract_type AS ENUM (
      'FIXED_TERM',
      'INDEFINITE_TERM',
      'WORK_CONTRACT',
      'SERVICE_CONTRACT'
    );
  END IF;
END
$$;
`);

  await client.query(`
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  employee_code varchar(20) NOT NULL,
  name varchar(255) NOT NULL,
  identification_type public.identification_type NOT NULL,
  identification varchar(20) NOT NULL,
  email varchar(255) NOT NULL,
  intl_dial_code varchar(5) DEFAULT '57',
  mobile varchar(20),
  full_mobile varchar(25),
  address varchar(255),
  city varchar(100) DEFAULT 'Medellin',
  department varchar(100) DEFAULT 'ANTIOQUIA',
  role_id uuid,
  contract_type public.contract_type,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
`);

  await client.query(`
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS identity_document_url varchar(500),
  ADD COLUMN IF NOT EXISTS rut_document_url varchar(500),
  ADD COLUMN IF NOT EXISTS commerce_chamber_document_url varchar(500),
  ADD COLUMN IF NOT EXISTS passport_document_url varchar(500),
  ADD COLUMN IF NOT EXISTS tax_certificate_document_url varchar(500),
  ADD COLUMN IF NOT EXISTS company_id_document_url varchar(500),
  ADD COLUMN IF NOT EXISTS hoja_de_vida_url varchar(500),
  ADD COLUMN IF NOT EXISTS certificado_laboral_url varchar(500),
  ADD COLUMN IF NOT EXISTS certificado_estudios_url varchar(500),
  ADD COLUMN IF NOT EXISTS eps_certificate_url varchar(500),
  ADD COLUMN IF NOT EXISTS pension_certificate_url varchar(500),
  ADD COLUMN IF NOT EXISTS bank_certificate_url varchar(500),
  ADD COLUMN IF NOT EXISTS employee_image_url varchar(500),
  ADD COLUMN IF NOT EXISTS signature_image_url varchar(500),
  ADD COLUMN IF NOT EXISTS company_image_url varchar(500),
  ADD COLUMN IF NOT EXISTS dv varchar(1),
  ADD COLUMN IF NOT EXISTS landline varchar(20),
  ADD COLUMN IF NOT EXISTS extension varchar(10);
`);

  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_employee_code_uniq ON public.employees(employee_code);`,
  );
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_identification_uniq ON public.employees(identification);`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);`,
  );

  await client.end();
  console.log("employees seed prereqs ensured");
}

void ensureEmployeesSeedPrereqs();
