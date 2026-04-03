import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { employees } from "@/src/db/erp/schema";
import {
  getEmployeeIdFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";

async function resolveEmployeeId(request: Request): Promise<string | null> {
  const direct = getEmployeeIdFromRequest(request);

  if (direct) return direct;

  const userId = getUserIdFromRequest(request);

  if (!userId) return null;

  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.userId, userId))
    .limit(1);

  return row?.id ?? null;
}

export async function GET(request: Request) {
  const employeeId = await resolveEmployeeId(request);

  if (!employeeId) {
    return new Response("No autenticado o sin perfil de empleado", {
      status: 401,
    });
  }

  const [employee] = await db
    .select({
      id: employees.id,
      name: employees.name,
      employeeCode: employees.employeeCode,
      certificadoLaboralUrl: employees.certificadoLaboralUrl,
      certificadoEstudiosUrl: employees.certificadoEstudiosUrl,
      epsCertificateUrl: employees.epsCertificateUrl,
      pensionCertificateUrl: employees.pensionCertificateUrl,
      bankCertificateUrl: employees.bankCertificateUrl,
      taxCertificateDocumentUrl: employees.taxCertificateDocumentUrl,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!employee) {
    return new Response("Empleado no encontrado", { status: 404 });
  }

  const certifications = [
    {
      key: "laboral",
      label: "Certificación laboral",
      url: employee.certificadoLaboralUrl,
    },
    {
      key: "estudios",
      label: "Certificación de estudios",
      url: employee.certificadoEstudiosUrl,
    },
    {
      key: "eps",
      label: "Certificación EPS",
      url: employee.epsCertificateUrl,
    },
    {
      key: "pension",
      label: "Certificación pensión",
      url: employee.pensionCertificateUrl,
    },
    {
      key: "banco",
      label: "Certificación bancaria",
      url: employee.bankCertificateUrl,
    },
    {
      key: "tributario",
      label: "Certificación tributaria",
      url: employee.taxCertificateDocumentUrl,
    },
  ];

  return Response.json({
    employee: {
      id: employee.id,
      name: employee.name,
      employeeCode: employee.employeeCode,
    },
    certifications,
  });
}
