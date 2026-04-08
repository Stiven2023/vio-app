import { jsonError, jsonNotFound, type FieldErrors } from "@/src/utils/api-error";

export type SiigoDryRunPreview = {
  prefacturaId: string;
  prefacturaCode: string;
  documentType: string | null;
  items: number;
  total: number;
  currency: string;
};

function withFieldErrors(
  status: number,
  code: string,
  message: string,
  fieldErrors?: FieldErrors,
  extras?: Record<string, unknown>,
) {
  return Response.json(
    {
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
      ...(extras ?? {}),
    },
    { status },
  );
}

export function normalizeProtectedRouteError(
  response: Response | null,
  forbiddenMessage = "No tienes permisos para realizar esta accion.",
) {
  if (!response) return null;

  if (response.status === 401) {
    return jsonError(401, "UNAUTHORIZED", "Usuario no autorizado o inactivo.");
  }

  if (response.status === 403) {
    return jsonError(403, "FORBIDDEN", forbiddenMessage);
  }

  return response;
}

export function prefacturaIdRequiredError() {
  return jsonError(
    400,
    "VALIDATION_ERROR",
    "El id de la prefactura es obligatorio.",
    {
      id: ["Debes indicar el id de la prefactura."],
    },
  );
}

export function prefacturaReasonRequiredError() {
  return jsonError(
    400,
    "VALIDATION_ERROR",
    "El motivo del reset es obligatorio.",
    {
      reason: ["Debes indicar el motivo del reset de SIIGO."],
    },
  );
}

export function prefacturaNotFoundError() {
  return jsonNotFound("Prefactura no encontrada.");
}

export function siigoNotApplicableError() {
  return jsonError(
    422,
    "SIIGO_NOT_APPLICABLE",
    "Esta prefactura es de tipo R y no aplica para envio a SIIGO.",
  );
}

export function siigoRequiresFullPaymentError(args: {
  paidAmount: number;
  totalAmount: number;
  overpaymentAmount: number;
}) {
  if (args.overpaymentAmount > 0) {
    return withFieldErrors(
      409,
      "REFUND_PENDING",
      "La prefactura tiene sobrepago y debe pasar a devolucion antes de enviar a SIIGO.",
      {
        paidAmount: ["El valor pagado supera el total de la prefactura."],
        overpaymentAmount: [
          `Hay ${args.overpaymentAmount.toFixed(2)} pendiente por devolver al cliente.`,
        ],
      },
      {
        paidAmount: args.paidAmount,
        totalAmount: args.totalAmount,
        overpaymentAmount: args.overpaymentAmount,
      },
    );
  }

  return withFieldErrors(
    422,
    "FULL_PAYMENT_REQUIRED",
    "Solo se puede enviar a SIIGO una prefactura 100% pagada.",
    {
      paidAmount: ["Debes completar el pago total antes de enviar a SIIGO."],
      totalAmount: ["El total pagado debe ser exactamente igual al total de la prefactura."],
    },
    {
      paidAmount: args.paidAmount,
      totalAmount: args.totalAmount,
      overpaymentAmount: args.overpaymentAmount,
    },
  );
}

export function siigoAlreadySentError(status: string) {
  return withFieldErrors(
    409,
    "SIIGO_ALREADY_SENT",
    "La prefactura ya fue enviada a SIIGO y no puede reenviarse sin reset.",
    {
      siigoStatus: [`La prefactura ya tiene estado bloqueante en SIIGO: ${status}.`],
    },
  );
}

export function siigoMissingClientIdentificationError() {
  return jsonError(
    422,
    "MISSING_CLIENT_IDENTIFICATION",
    "El cliente debe tener numero de identificacion antes de enviar a SIIGO.",
    {
      clientIdentification: [
        "Completa la identificacion del cliente antes de enviar la prefactura.",
      ],
    },
  );
}

export function siigoMissingConfigurationError(args: {
  missingConfig: string[];
  invalidConfig: string[];
}) {
  const fieldErrors: FieldErrors = {};

  for (const key of args.missingConfig) {
    fieldErrors[key] = ["Configuracion obligatoria faltante para SIIGO."];
  }

  for (const key of args.invalidConfig) {
    fieldErrors[key] = ["Configuracion obligatoria invalida para SIIGO."];
  }

  return withFieldErrors(
    422,
    "SIIGO_CONFIGURATION_INVALID",
    "Faltan configuraciones obligatorias de SIIGO para enviar la factura.",
    fieldErrors,
    {
      missingConfig: args.missingConfig,
      invalidConfig: args.invalidConfig,
    },
  );
}

export function siigoDryRunError(args: {
  liveSubmissionEnabled: boolean;
  productionEnvironment: boolean;
  preview: SiigoDryRunPreview;
}) {
  return withFieldErrors(
    409,
    "SIIGO_DRY_RUN",
    "Modo prueba activo. No se envio la factura a SIIGO.",
    {
      siigo: [
        "Activa SIIGO_ALLOW_LIVE_SUBMISSION=true y NODE_ENV=production para envio real.",
      ],
    },
    {
      liveSubmissionEnabled: args.liveSubmissionEnabled,
      productionEnvironment: args.productionEnvironment,
      preview: args.preview,
    },
  );
}

export function siigoInvoiceIdRequiredError(currentStatus: string | null) {
  return withFieldErrors(
    422,
    "SIIGO_INVOICE_ID_REQUIRED",
    "La prefactura todavia no tiene un invoice id de SIIGO.",
    {
      siigoInvoiceId: ["Envia la prefactura a SIIGO antes de consultar el estado."],
    },
    {
      siigoStatus: currentStatus,
    },
  );
}

export function siigoResetNotAllowedError() {
  return jsonError(
    409,
    "SIIGO_RESET_NOT_ALLOWED",
    "Las prefacturas tipo R no pueden resetearse para SIIGO.",
  );
}

export function siigoUpstreamError(message: string) {
  return withFieldErrors(
    502,
    "SIIGO_ERROR",
    message,
  );
}

export function siigoInternalError(message: string) {
  return jsonError(500, "INTERNAL_ERROR", message);
}
