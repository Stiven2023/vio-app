import { z } from "zod";

import {
  mesEnvioStatusValues,
  mesPaymentStatusValues,
  mesProductionStageAreaValues,
  mesRepoReasonValues,
  mesReposicionStatusValues,
  mesSampleApprovalStatusValues,
  mesShipmentAreaValues,
  mesTransportTypeValues,
} from "@/src/db/enums";

const shipmentAreaEnum = z.enum(
  mesShipmentAreaValues as unknown as [string, ...string[]],
);
const transportTypeEnum = z.enum(
  mesTransportTypeValues as unknown as [string, ...string[]],
);
const envioStatusEnum = z.enum(
  mesEnvioStatusValues as unknown as [string, ...string[]],
);

const optionalText = z
  .string()
  .trim()
  .max(500, "El texto supera el tamaño permitido.")
  .nullable()
  .optional();

const approvalStepSchema = z.object({
  approved: z.boolean().optional().default(false),
  approverName: z.string().trim().max(150).nullable().optional(),
  approvedAt: z.string().trim().min(1).nullable().optional(),
  notes: optionalText,
});

export const mesDispatchApprovalsSchema = z.object({
  seller: approvalStepSchema,
  cartera: approvalStepSchema,
  accounting: approvalStepSchema,
  partial: approvalStepSchema.optional(),
});

export type DispatchApprovalInputStep = {
  approved?: boolean;
  approverName?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
};

export type DispatchApprovalStep = {
  approved: boolean;
  approverName: string | null;
  approvedAt: string | null;
  notes: string | null;
};

export type DispatchApprovalsInput = {
  seller: DispatchApprovalInputStep;
  cartera: DispatchApprovalInputStep;
  accounting: DispatchApprovalInputStep;
  partial?: DispatchApprovalInputStep | null;
};

export type DispatchApprovalsSnapshot = {
  seller: DispatchApprovalStep;
  cartera: DispatchApprovalStep;
  accounting: DispatchApprovalStep;
  partial?: DispatchApprovalStep | null;
};

export const mesEnvioItemSchema = z.object({
  orderItemId: z.string().trim().min(1, "El diseño es obligatorio."),
  quantity: z
    .number()
    .int("La cantidad debe ser un entero.")
    .positive("La cantidad debe ser mayor a 0."),
  notes: optionalText,
});

export const mesEnvioCreateSchema = z
  .object({
    orderId: z.string().trim().min(1, "El pedido es obligatorio."),
    origenArea: shipmentAreaEnum,
    origenNombre: z.string().trim().max(150).nullable().optional(),
    destinoArea: shipmentAreaEnum,
    destinoNombre: z.string().trim().max(150).nullable().optional(),
    transporteTipo: transportTypeEnum,
    transportistaEmpleadoId: z.string().trim().max(120).nullable().optional(),
    transportistaNombre: z.string().trim().max(150).nullable().optional(),
    empresaTercero: z.string().trim().max(150).nullable().optional(),
    guiaNumero: z.string().trim().max(80).nullable().optional(),
    placa: z.string().trim().max(20).nullable().optional(),
    requiereSegundaParada: z.boolean().optional().default(false),
    segundaParadaTipo: z.string().trim().max(80).nullable().optional(),
    segundaParadaDestino: z.string().trim().max(200).nullable().optional(),
    observaciones: optionalText,
    evidenciaUrl: z.string().trim().url().nullable().optional(),
    salidaAt: z.string().trim().min(1).nullable().optional(),
    dispatchApprovals: mesDispatchApprovalsSchema.optional(),
    items: z
      .array(mesEnvioItemSchema)
      .min(1, "Selecciona al menos un diseño para el envío."),
  })
  .superRefine((payload, ctx) => {
    const seen = new Set<string>();

    payload.items.forEach((item, index) => {
      const key = item.orderItemId.trim();

      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "orderItemId"],
          message: "No repitas el mismo diseño en el envío.",
        });
      }

      seen.add(key);
    });

    if (
      payload.transporteTipo === "LINEA_TERCERO" &&
      !String(payload.empresaTercero ?? "").trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["empresaTercero"],
        message: "La empresa de transporte es obligatoria para línea tercero.",
      });
    }

    if (
      payload.requiereSegundaParada &&
      !String(payload.segundaParadaTipo ?? "").trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["segundaParadaTipo"],
        message: "Indica el tipo de segunda parada.",
      });
    }

    if (
      payload.requiereSegundaParada &&
      !String(payload.segundaParadaDestino ?? "").trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["segundaParadaDestino"],
        message: "Indica el destino de la segunda parada.",
      });
    }

    if (isDispatchShipment(payload)) {
      if (!payload.dispatchApprovals) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dispatchApprovals"],
          message: "Debes registrar las aprobaciones de despacho.",
        });
        return;
      }

      for (const key of ["seller", "cartera", "accounting"] as const) {
        const step = payload.dispatchApprovals[key];

        if (!step.approved) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["dispatchApprovals", key, "approved"],
            message: "Esta aprobación es obligatoria para despacho.",
          });
        }

        if (step.approved && !String(step.approverName ?? "").trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["dispatchApprovals", key, "approverName"],
            message: "Indica quién aprobó este paso.",
          });
        }
      }
    }
  });

export const mesEnvioUpdateSchema = z.object({
  status: envioStatusEnum,
  salidaAt: z.string().trim().min(1).nullable().optional(),
  llegadaAt: z.string().trim().min(1).nullable().optional(),
  retornoAt: z.string().trim().min(1).nullable().optional(),
  observaciones: optionalText,
  evidenciaUrl: z.string().trim().url().nullable().optional(),
  dispatchApprovals: mesDispatchApprovalsSchema.optional(),
});

export type QueueAccountingSnapshot = {
  orderCode: string;
  accountingStatus?: string | null;
  advanceReceived?: string | number | null;
  advanceStatus?: string | null;
};

export function toAdvanceAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;

  const normalized = String(value).trim().replace(/\./g, "").replace(/,/g, ".");
  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : 0;
}

export function hasAccountingApproval(snapshot: {
  accountingStatus?: string | null;
  advanceReceived?: string | number | null;
  advanceStatus?: string | null;
}) {
  const accountingStatus = String(snapshot.accountingStatus ?? "")
    .trim()
    .toUpperCase();
  const advanceStatus = String(snapshot.advanceStatus ?? "")
    .trim()
    .toUpperCase();

  return (
    toAdvanceAmount(snapshot.advanceReceived) > 0 ||
    advanceStatus === "RECIBIDO" ||
    advanceStatus === "PAGADO" ||
    (accountingStatus.length > 0 && accountingStatus !== "PENDIENTE_CONTABILIDAD")
  );
}

export function findBlockedOrdersForQueueConfirmation(
  snapshots: QueueAccountingSnapshot[],
) {
  return Array.from(
    new Set(
      snapshots
        .filter((snapshot) => !hasAccountingApproval(snapshot))
        .map((snapshot) => snapshot.orderCode.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export function isDispatchShipment(args: {
  origenArea: string;
  destinoArea: string;
}) {
  return args.origenArea === "DESPACHO" && args.destinoArea === "DESPACHO";
}

export function normalizeDispatchApprovals(
  approvals: DispatchApprovalsInput | DispatchApprovalsSnapshot | undefined,
  nowIso = new Date().toISOString(),
): DispatchApprovalsSnapshot | null {
  if (!approvals) return null;

  const normalizeStep = (
    step: DispatchApprovalInputStep | DispatchApprovalStep | null | undefined,
  ): DispatchApprovalStep => ({
    approved: Boolean(step?.approved),
    approverName: String(step?.approverName ?? "").trim() || null,
    approvedAt: step?.approved
      ? String(step?.approvedAt ?? "").trim() || nowIso
      : null,
    notes: String(step?.notes ?? "").trim() || null,
  });

  return {
    seller: normalizeStep(approvals.seller),
    cartera: normalizeStep(approvals.cartera),
    accounting: normalizeStep(approvals.accounting),
    partial: approvals.partial ? normalizeStep(approvals.partial) : null,
  };
}

type DispatchBlockingRule = {
  status: number;
  code: string;
  message: string;
  fieldErrors: Record<string, string[]>;
};

export function getDispatchBlockingRule(args: {
  legalEnabled: boolean;
  sellerApproved: boolean;
  carteraApproved: boolean;
  accountingApproved: boolean;
  isPartialDispatch: boolean;
  partialDispatchApproved: boolean;
}): DispatchBlockingRule | null {
  if (!args.legalEnabled) {
    return {
      status: 422,
      code: "CLIENT_LEGAL_BLOCK",
      message: "El cliente no está habilitado jurídicamente para despacho.",
      fieldErrors: {
        clientId: ["El estado jurídico del cliente bloquea el despacho."],
      },
    };
  }

  if (!args.sellerApproved) {
    return {
      status: 422,
      code: "SELLER_APPROVAL_REQUIRED",
      message: "El despacho requiere aprobación explícita del vendedor.",
      fieldErrors: {
        sellerApproval: ["El vendedor debe aprobar antes de despachar."],
      },
    };
  }

  if (!args.carteraApproved) {
    return {
      status: 422,
      code: "RECEIVABLES_APPROVAL_REQUIRED",
      message: "El despacho requiere aprobación explícita de cartera.",
      fieldErrors: {
        carteraApproval: ["Cartera debe aprobar antes de despachar."],
      },
    };
  }

  if (!args.accountingApproved) {
    return {
      status: 422,
      code: "ACCOUNTING_APPROVAL_REQUIRED",
      message: "El pedido todavía no tiene OK de contabilidad para despacho.",
      fieldErrors: {
        accountingStatus: ["Contabilidad debe aprobar antes de despachar."],
      },
    };
  }

  if (args.isPartialDispatch && !args.partialDispatchApproved) {
    return {
      status: 422,
      code: "PARTIAL_DISPATCH_APPROVAL_REQUIRED",
      message:
        "El despacho parcial requiere aprobación explícita antes de continuar.",
      fieldErrors: {
        partialDispatch: [
          "Marca y documenta la aprobación de despacho parcial antes de despachar.",
        ],
      },
    };
  }

  return null;
}

const ALLOWED_ENVIO_TRANSITIONS = new Map<string, Set<string>>([
  ["CREADO", new Set(["EN_RUTA", "INCIDENTE"])],
  ["EN_RUTA", new Set(["ENTREGADO", "RETORNADO", "INCIDENTE"])],
  ["ENTREGADO", new Set(["RETORNADO"])],
  ["RETORNADO", new Set()],
  ["INCIDENTE", new Set()],
]);

export function isValidEnvioStatusTransition(current: string, next: string) {
  if (current === next) return true;

  const allowed = ALLOWED_ENVIO_TRANSITIONS.get(current);

  if (!allowed) return false;

  return allowed.has(next);
}

export function toValidDate(value: string | null | undefined) {
  const raw = String(value ?? "").trim();

  if (!raw) return null;

  const date = new Date(raw);

  return Number.isNaN(date.getTime()) ? null : date;
}

// ─── Schemas: Registro de salida física ──────────────────────────────────────

export const mesEnvioSalidaSchema = z.object({
  salidaAt: z.string().datetime({ message: "La fecha/hora de salida debe ser una fecha ISO 8601 válida." }),
  courierBroughtBy: z.string().trim().max(150).nullable().optional(),
  logisticOperator: z.string().trim().max(100).nullable().optional(),
  destinationAddress: z.string().trim().max(500).nullable().optional(),
  requiresDeclaredValue: z.boolean().optional().default(false),
  observaciones: z.string().trim().max(500).nullable().optional(),
});

export type MesEnvioSalidaInput = z.infer<typeof mesEnvioSalidaSchema>;

// ─── Schemas: Estado de pago envío ───────────────────────────────────────────

const paymentStatusEnum = z.enum(
  mesPaymentStatusValues as unknown as [string, ...string[]],
);

export const mesEnvioPaymentSchema = z.object({
  paymentStatus: paymentStatusEnum,
  receptionLocation: z.string().trim().max(200).nullable().optional(),
  receptionStatus: z.string().trim().max(50).nullable().optional(),
});

export type MesEnvioPaymentInput = z.infer<typeof mesEnvioPaymentSchema>;

// ─── Schemas: Etapas de producción ───────────────────────────────────────────

const productionStageAreaEnum = z.enum(
  mesProductionStageAreaValues as unknown as [string, ...string[]],
);

export const mesProductionStageCreateSchema = z.object({
  orderId: z.string().trim().min(1, "El pedido es obligatorio."),
  orderItemId: z.string().trim().min(1, "El diseño es obligatorio."),
  area: productionStageAreaEnum,
  stageName: z.string().trim().max(100).nullable().optional(),
  startedAt: z.string().trim().min(1).nullable().optional(),
  endedAt: z.string().trim().min(1).nullable().optional(),
  operatorId: z.string().trim().uuid().nullable().optional(),
  operatorName: z.string().trim().max(150).nullable().optional(),
  machineId: z.string().trim().max(60).nullable().optional(),
  machineName: z.string().trim().max(100).nullable().optional(),
  quantityProcessed: z
    .number()
    .int()
    .min(0, "La cantidad debe ser mayor o igual a 0.")
    .optional()
    .default(0),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const mesProductionStageUpdateSchema = z.object({
  endedAt: z.string().trim().min(1).nullable().optional(),
  operatorName: z.string().trim().max(150).nullable().optional(),
  machineId: z.string().trim().max(60).nullable().optional(),
  machineName: z.string().trim().max(100).nullable().optional(),
  quantityProcessed: z.number().int().min(0).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export type MesProductionStageCreateInput = z.infer<typeof mesProductionStageCreateSchema>;
export type MesProductionStageUpdateInput = z.infer<typeof mesProductionStageUpdateSchema>;

// ─── Schemas: Reposiciones ───────────────────────────────────────────────────

const repoReasonEnum = z.enum(
  mesRepoReasonValues as unknown as [string, ...string[]],
);
const reposicionStatusEnum = z.enum(
  mesReposicionStatusValues as unknown as [string, ...string[]],
);

/** Genera código único de reposición: RD + timestamp base36 + random */
export function generateRepositionCode(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-3);
  const rnd = Math.random().toString(36).slice(2, 4).toUpperCase().padEnd(2, "0");
  return `RD${ts}${rnd}`;
}

export const mesReposicionCreateSchema = z.object({
  orderId: z.string().trim().min(1, "El pedido es obligatorio."),
  orderItemId: z.string().trim().min(1, "El diseño es obligatorio."),
  causeCode: repoReasonEnum,
  requestingProcess: z.string().trim().max(80).nullable().optional(),
  quantityRequested: z
    .number()
    .int()
    .positive("La cantidad debe ser mayor a 0.")
    .optional()
    .default(1),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const mesReposicionUpdateSchema = z.object({
  status: reposicionStatusEnum.optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  closedAt: z.string().trim().min(1).nullable().optional(),
});

export type MesReposicionCreateInput = z.infer<typeof mesReposicionCreateSchema>;
export type MesReposicionUpdateInput = z.infer<typeof mesReposicionUpdateSchema>;

// ─── Schemas: Aprobación de muestra ─────────────────────────────────────────

const sampleApprovalStatusEnum = z.enum(
  mesSampleApprovalStatusValues as unknown as [string, ...string[]],
);

export const mesSampleApprovalUpsertSchema = z.object({
  orderId: z.string().trim().min(1, "El pedido es obligatorio."),
  assemblyPin: z.string().trim().max(50).nullable().optional(),
  sampleApprovalStatus: sampleApprovalStatusEnum.optional().default("PENDIENTE"),
  sampleApprovedAt: z.string().trim().min(1).nullable().optional(),
  sampleApprovedBy: z.string().trim().max(150).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export type MesSampleApprovalUpsertInput = z.infer<typeof mesSampleApprovalUpsertSchema>;