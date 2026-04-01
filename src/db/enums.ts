import { z } from "zod";

/* ========================= */
/*   PURCHASE ORDER ENUMS    */
/* ========================= */

export const PurchaseOrderStatus = {
  PENDIENTE: "PENDIENTE",
  APROBADA: "APROBADA",
  RECHAZADA: "RECHAZADA",
  EN_PROCESO: "EN_PROCESO",
  FINALIZADA: "FINALIZADA",
  VENCIDA: "VENCIDA",
  CANCELADA: "CANCELADA",
} as const;

export const purchaseOrderStatusValues = [
  "PENDIENTE",
  "APROBADA",
  "RECHAZADA",
  "EN_PROCESO",
  "FINALIZADA",
  "VENCIDA",
  "CANCELADA",
] as const;

export const PurchaseOrderStatusEnum = z.enum(purchaseOrderStatusValues);
Object.defineProperty(PurchaseOrderStatusEnum, "enumValues", {
  value: purchaseOrderStatusValues,
});

export const PurchaseOrderRouteType = {
  COMPRA_APROBADA: "COMPRA_APROBADA",
  DESPACHO_CLIENTE: "DESPACHO_CLIENTE",
  LLEVADA_CONFECCION: "LLEVADA_CONFECCION",
  RETORNO_CONFECCION: "RETORNO_CONFECCION",
} as const;

export const purchaseOrderRouteTypeValues = [
  "COMPRA_APROBADA",
  "DESPACHO_CLIENTE",
  "LLEVADA_CONFECCION",
  "RETORNO_CONFECCION",
] as const;

export const PurchaseOrderRouteTypeEnum = z.enum(purchaseOrderRouteTypeValues);
Object.defineProperty(PurchaseOrderRouteTypeEnum, "enumValues", {
  value: purchaseOrderRouteTypeValues,
});

export const PurchaseOrderPartyType = {
  PROVEEDOR: "PROVEEDOR",
  CONFECCIONISTA: "CONFECCIONISTA",
  EMPAQUE: "EMPAQUE",
  MENSAJERO: "MENSAJERO",
  CONDUCTOR: "CONDUCTOR",
  DESPACHO: "DESPACHO",
} as const;

export const purchaseOrderPartyTypeValues = [
  "PROVEEDOR",
  "CONFECCIONISTA",
  "EMPAQUE",
  "MENSAJERO",
  "CONDUCTOR",
  "DESPACHO",
] as const;

export const PurchaseOrderPartyTypeEnum = z.enum(purchaseOrderPartyTypeValues);
Object.defineProperty(PurchaseOrderPartyTypeEnum, "enumValues", {
  value: purchaseOrderPartyTypeValues,
});

export const PurchaseOrderRouteStatus = {
  PENDIENTE: "PENDIENTE",
  EN_RUTA: "EN_RUTA",
  COMPLETADA: "COMPLETADA",
  CANCELADA: "CANCELADA",
} as const;

export const purchaseOrderRouteStatusValues = [
  "PENDIENTE",
  "EN_RUTA",
  "COMPLETADA",
  "CANCELADA",
] as const;

export const PurchaseOrderRouteStatusEnum = z.enum(
  purchaseOrderRouteStatusValues,
);
Object.defineProperty(PurchaseOrderRouteStatusEnum, "enumValues", {
  value: purchaseOrderRouteStatusValues,
});

/* ========================= */
/*      CLIENT ENUMS         */
/* ========================= */

export const ClientType = {
  NACIONAL: "NACIONAL",
  EXTRANJERO: "EXTRANJERO",
  EMPLEADO: "EMPLEADO",
} as const;

export const clientTypeValues = ["NACIONAL", "EXTRANJERO", "EMPLEADO"] as const;

export const ClientTypeEnum = z.enum(clientTypeValues);
Object.defineProperty(ClientTypeEnum, "enumValues", {
  value: clientTypeValues,
});

export const IdentificationType = {
  CC: "CC",
  NIT: "NIT",
  CE: "CE",
  PAS: "PAS",
  EMPRESA_EXTERIOR: "EMPRESA_EXTERIOR",
} as const;

export const identificationTypeValues = [
  "CC",
  "NIT",
  "CE",
  "PAS",
  "EMPRESA_EXTERIOR",
] as const;

export const IdentificationTypeEnum = z.enum(identificationTypeValues);
Object.defineProperty(IdentificationTypeEnum, "enumValues", {
  value: identificationTypeValues,
});

export const TaxRegime = {
  REGIMEN_COMUN: "REGIMEN_COMUN",
  REGIMEN_SIMPLIFICADO: "REGIMEN_SIMPLIFICADO",
  NO_RESPONSABLE: "NO_RESPONSABLE",
} as const;

export const taxRegimeValues = [
  "REGIMEN_COMUN",
  "REGIMEN_SIMPLIFICADO",
  "NO_RESPONSABLE",
] as const;

export const TaxRegimeEnum = z.enum(taxRegimeValues);
Object.defineProperty(TaxRegimeEnum, "enumValues", {
  value: taxRegimeValues,
});

export const ClientStatus = {
  ACTIVO: "ACTIVO",
  INACTIVO: "INACTIVO",
  SUSPENDIDO: "SUSPENDIDO",
} as const;

export const clientStatusValues = ["ACTIVO", "INACTIVO", "SUSPENDIDO"] as const;

export const ClientStatusEnum = z.enum(clientStatusValues);
Object.defineProperty(ClientStatusEnum, "enumValues", {
  value: clientStatusValues,
});

export const ClientPriceType = {
  AUTORIZADO: "AUTORIZADO",
  MAYORISTA: "MAYORISTA",
  VIOMAR: "VIOMAR",
  COLANTA: "COLANTA",
} as const;

export const clientPriceTypeValues = [
  "AUTORIZADO",
  "MAYORISTA",
  "VIOMAR",
  "COLANTA",
] as const;

export const ClientPriceTypeEnum = z.enum(clientPriceTypeValues);
Object.defineProperty(ClientPriceTypeEnum, "enumValues", {
  value: clientPriceTypeValues,
});

export const ThirdPartyType = {
  EMPLEADO: "EMPLEADO",
  CLIENTE: "CLIENTE",
  CONFECCIONISTA: "CONFECCIONISTA",
  PROVEEDOR: "PROVEEDOR",
  EMPAQUE: "EMPAQUE",
} as const;

export const thirdPartyTypeValues = [
  "EMPLEADO",
  "CLIENTE",
  "CONFECCIONISTA",
  "PROVEEDOR",
  "EMPAQUE",
] as const;

export const ThirdPartyTypeEnum = z.enum(thirdPartyTypeValues);
Object.defineProperty(ThirdPartyTypeEnum, "enumValues", {
  value: thirdPartyTypeValues,
});

export const LegalStatus = {
  VIGENTE: "VIGENTE",
  EN_REVISION: "EN_REVISION",
  BLOQUEADO: "BLOQUEADO",
} as const;

export const legalStatusValues = [
  "VIGENTE",
  "EN_REVISION",
  "BLOQUEADO",
] as const;

export const LegalStatusEnum = z.enum(legalStatusValues);
Object.defineProperty(LegalStatusEnum, "enumValues", {
  value: legalStatusValues,
});

/* ========================= */
/*     DOCUMENT ENUMS        */
/* ========================= */

export const DocumentType = {
  F: "F",
  R: "R",
} as const;

export const documentTypeValues = ["F", "R"] as const;

export const DocumentTypeEnum = z.enum(documentTypeValues);
Object.defineProperty(DocumentTypeEnum, "enumValues", {
  value: documentTypeValues,
});

/* ========================= */
/*     TAX & PAYMENT ENUMS   */
/* ========================= */

export const TaxZone = {
  CONTINENTAL: "CONTINENTAL",
  FREE_ZONE: "FREE_ZONE",
  SAN_ANDRES: "SAN_ANDRES",
  SPECIAL_REGIME: "SPECIAL_REGIME",
} as const;

export const taxZoneValues = [
  "CONTINENTAL",
  "FREE_ZONE",
  "SAN_ANDRES",
  "SPECIAL_REGIME",
] as const;

export const TaxZoneEnum = z.enum(taxZoneValues);
Object.defineProperty(TaxZoneEnum, "enumValues", {
  value: taxZoneValues,
});

export const PaymentType = {
  CASH: "CASH",
  CREDIT: "CREDIT",
} as const;

export const paymentTypeValues = ["CASH", "CREDIT"] as const;

export const PaymentTypeEnum = z.enum(paymentTypeValues);
Object.defineProperty(PaymentTypeEnum, "enumValues", {
  value: paymentTypeValues,
});

export const CreditBackingType = {
  PROMISSORY_NOTE: "PROMISSORY_NOTE",
  PURCHASE_ORDER: "PURCHASE_ORDER",
  VERBAL_AGREEMENT: "VERBAL_AGREEMENT",
} as const;

export const creditBackingTypeValues = [
  "PROMISSORY_NOTE",
  "PURCHASE_ORDER",
  "VERBAL_AGREEMENT",
] as const;

export const CreditBackingTypeEnum = z.enum(creditBackingTypeValues);
Object.defineProperty(CreditBackingTypeEnum, "enumValues", {
  value: creditBackingTypeValues,
});

export const CashReceiptStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  VOIDED: "VOIDED",
} as const;

export const cashReceiptStatusValues = [
  "PENDING",
  "CONFIRMED",
  "VOIDED",
] as const;

export const CashReceiptStatusEnum = z.enum(cashReceiptStatusValues);
Object.defineProperty(CashReceiptStatusEnum, "enumValues", {
  value: cashReceiptStatusValues,
});

export const ReconciliationItemType = {
  DEPOSIT_IN_TRANSIT: "DEPOSIT_IN_TRANSIT",
  OUTSTANDING_CHECK: "OUTSTANDING_CHECK",
  BANK_DEBIT_NOTE: "BANK_DEBIT_NOTE",
  BANK_CREDIT_NOTE: "BANK_CREDIT_NOTE",
  ACCOUNTING_ERROR: "ACCOUNTING_ERROR",
  BANK_ERROR: "BANK_ERROR",
} as const;

export const reconciliationItemTypeValues = [
  "DEPOSIT_IN_TRANSIT",
  "OUTSTANDING_CHECK",
  "BANK_DEBIT_NOTE",
  "BANK_CREDIT_NOTE",
  "ACCOUNTING_ERROR",
  "BANK_ERROR",
] as const;

export const ReconciliationItemTypeEnum = z.enum(reconciliationItemTypeValues);
Object.defineProperty(ReconciliationItemTypeEnum, "enumValues", {
  value: reconciliationItemTypeValues,
});

export const FactoringStatus = {
  ACTIVE: "ACTIVE",
  COLLECTED: "COLLECTED",
  VOIDED: "VOIDED",
} as const;

export const factoringStatusValues = ["ACTIVE", "COLLECTED", "VOIDED"] as const;

export const FactoringStatusEnum = z.enum(factoringStatusValues);
Object.defineProperty(FactoringStatusEnum, "enumValues", {
  value: factoringStatusValues,
});

/* ========================= */
/*     HR ENUMS             */
/* ========================= */

export const ContractType = {
  FIXED_TERM: "FIXED_TERM",
  INDEFINITE_TERM: "INDEFINITE_TERM",
  WORK_CONTRACT: "WORK_CONTRACT",
  SERVICE_CONTRACT: "SERVICE_CONTRACT",
} as const;

export const contractTypeValues = [
  "FIXED_TERM",
  "INDEFINITE_TERM",
  "WORK_CONTRACT",
  "SERVICE_CONTRACT",
] as const;

export const ContractTypeEnum = z.enum(contractTypeValues);
Object.defineProperty(ContractTypeEnum, "enumValues", {
  value: contractTypeValues,
});

export const LeaveType = {
  PAID: "PAID",
  UNPAID: "UNPAID",
} as const;

export const leaveTypeValues = ["PAID", "UNPAID"] as const;

export const LeaveTypeEnum = z.enum(leaveTypeValues);
Object.defineProperty(LeaveTypeEnum, "enumValues", {
  value: leaveTypeValues,
});

/* ========================= */
/*  EMPLOYEE REQUEST ENUMS   */
/* ========================= */

export const EmployeeRequestType = {
  PERMISO: "PERMISO",
  RECLAMO: "RECLAMO",
  SOLICITUD: "SOLICITUD",
  SUGERENCIA: "SUGERENCIA",
  PQR: "PQR",
} as const;

export const employeeRequestTypeValues = [
  "PERMISO",
  "RECLAMO",
  "SOLICITUD",
  "SUGERENCIA",
  "PQR",
] as const;

export const EmployeeRequestTypeEnum = z.enum(employeeRequestTypeValues);
Object.defineProperty(EmployeeRequestTypeEnum, "enumValues", {
  value: employeeRequestTypeValues,
});

export const EmployeeRequestStatus = {
  PENDIENTE: "PENDIENTE",
  EN_REVISION: "EN_REVISION",
  APROBADO: "APROBADO",
  RECHAZADO: "RECHAZADO",
  RESUELTO: "RESUELTO",
} as const;

export const employeeRequestStatusValues = [
  "PENDIENTE",
  "EN_REVISION",
  "APROBADO",
  "RECHAZADO",
  "RESUELTO",
] as const;

export const EmployeeRequestStatusEnum = z.enum(employeeRequestStatusValues);
Object.defineProperty(EmployeeRequestStatusEnum, "enumValues", {
  value: employeeRequestStatusValues,
});

export const EmployeeRequestPriority = {
  BAJA: "BAJA",
  MEDIA: "MEDIA",
  ALTA: "ALTA",
} as const;

export const employeeRequestPriorityValues = ["BAJA", "MEDIA", "ALTA"] as const;

export const EmployeeRequestPriorityEnum = z.enum(
  employeeRequestPriorityValues,
);
Object.defineProperty(EmployeeRequestPriorityEnum, "enumValues", {
  value: employeeRequestPriorityValues,
});

/* ========================= */
/*     ROLE ENUMS           */
/* ========================= */

export const Role = {
  ADMINISTRADOR: "ADMINISTRADOR",
  LIDER_JURIDICA: "LIDER_JURIDICA",
  RH: "RH",
  AUXILIAR_RH: "AUXILIAR_RH",
  LIDER_FINANCIERA: "LIDER_FINANCIERA",
  AUXILIAR_CONTABLE: "AUXILIAR_CONTABLE",
  TESORERIA_Y_CARTERA: "TESORERIA_Y_CARTERA",
  LIDER_COMERCIAL: "LIDER_COMERCIAL",
  ASESOR: "ASESOR",
  LIDER_SUMINISTROS: "LIDER_SUMINISTROS",
  COMPRA_NACIONAL: "COMPRA_NACIONAL",
  COMPRA_INTERNACIONAL: "COMPRA_INTERNACIONAL",
  LIDER_DISEÑO: "LIDER_DISEÑO",
  DISEÑADOR: "DISEÑADOR",
  LIDER_OPERACIONAL: "LIDER_OPERACIONAL",
  PROGRAMACION: "PROGRAMACION",
  OPERARIO_DESPACHO: "OPERARIO_DESPACHO",
  OPERARIO_BODEGA: "OPERARIO_BODEGA",
  OPERARIO: "OPERARIO",
  OPERARIO_INTEGRACION_CALIDAD: "OPERARIO_INTEGRACION_CALIDAD",
  CONFECCIONISTA: "CONFECCIONISTA",
  EMPAQUE: "EMPAQUE",
} as const;

export const roleValues = [
  "ADMINISTRADOR",
  "LIDER_JURIDICA",
  "RH",
  "AUXILIAR_RH",
  "LIDER_FINANCIERA",
  "AUXILIAR_CONTABLE",
  "TESORERIA_Y_CARTERA",
  "LIDER_COMERCIAL",
  "ASESOR",
  "LIDER_SUMINISTROS",
  "COMPRA_NACIONAL",
  "COMPRA_INTERNACIONAL",
  "LIDER_DISEÑO",
  "DISEÑADOR",
  "LIDER_OPERACIONAL",
  "PROGRAMACION",
  "OPERARIO_DESPACHO",
  "OPERARIO_BODEGA",
  "OPERARIO",
  "OPERARIO_INTEGRACION_CALIDAD",
  "CONFECCIONISTA",
  "EMPAQUE",
] as const;

export const RoleEnum = z.enum(roleValues);
Object.defineProperty(RoleEnum, "enumValues", {
  value: roleValues,
});

/* ========================= */
/*     PERMISSION ENUMS     */
/* ========================= */

export const Permission = {
  // Pedidos
  CREAR_PEDIDO: "CREAR_PEDIDO",
  EDITAR_PEDIDO: "EDITAR_PEDIDO",
  ELIMINAR_PEDIDO: "ELIMINAR_PEDIDO",
  VER_PEDIDO: "VER_PEDIDO",
  CAMBIAR_ESTADO_PEDIDO: "CAMBIAR_ESTADO_PEDIDO",
  // Diseños
  CREAR_DISEÑO: "CREAR_DISEÑO",
  EDITAR_DISEÑO: "EDITAR_DISEÑO",
  ELIMINAR_DISEÑO: "ELIMINAR_DISEÑO",
  VER_DISEÑO: "VER_DISEÑO",
  EDITAR_IMAGEN: "EDITAR_IMAGEN",
  ASIGNAR_DISEÑO: "ASIGNAR_DISEÑO",
  CAMBIAR_ESTADO_DISEÑO: "CAMBIAR_ESTADO_DISEÑO",
  // Pagos
  CREAR_PAGO: "CREAR_PAGO",
  EDITAR_PAGO: "EDITAR_PAGO",
  APROBAR_PAGO: "APROBAR_PAGO",
  VER_PAGO: "VER_PAGO",
  // Inventario
  CREAR_ITEM_INVENTARIO: "CREAR_ITEM_INVENTARIO",
  EDITAR_ITEM_INVENTARIO: "EDITAR_ITEM_INVENTARIO",
  ELIMINAR_ITEM_INVENTARIO: "ELIMINAR_ITEM_INVENTARIO",
  VER_ITEM_INVENTARIO: "VER_ITEM_INVENTARIO",
  REGISTRAR_ENTRADA: "REGISTRAR_ENTRADA",
  REGISTRAR_SALIDA: "REGISTRAR_SALIDA",
  VER_INVENTARIO: "VER_INVENTARIO",
  // Empaque
  CREAR_EMPAQUE: "CREAR_EMPAQUE",
  EDITAR_EMPAQUE: "EDITAR_EMPAQUE",
  ELIMINAR_EMPAQUE: "ELIMINAR_EMPAQUE",
  MARCAR_EMPAQUE: "MARCAR_EMPAQUE",
  VER_EMPAQUE: "VER_EMPAQUE",
  // Compras
  CREAR_ORDEN_COMPRA: "CREAR_ORDEN_COMPRA",
  ASOCIAR_PROVEEDOR: "ASOCIAR_PROVEEDOR",
  // Proveedores
  CREAR_PROVEEDOR: "CREAR_PROVEEDOR",
  EDITAR_PROVEEDOR: "EDITAR_PROVEEDOR",
  ELIMINAR_PROVEEDOR: "ELIMINAR_PROVEEDOR",
  VER_PROVEEDOR: "VER_PROVEEDOR",
  // Clientes
  CREAR_CLIENTE: "CREAR_CLIENTE",
  EDITAR_CLIENTE: "EDITAR_CLIENTE",
  ELIMINAR_CLIENTE: "ELIMINAR_CLIENTE",
  VER_CLIENTE: "VER_CLIENTE",
  VER_ESTADO_JURIDICO_CLIENTE: "VER_ESTADO_JURIDICO_CLIENTE",
  CAMBIAR_ESTADO_JURIDICO_CLIENTE: "CAMBIAR_ESTADO_JURIDICO_CLIENTE",
  VER_ESTADO_JURIDICO_EMPLEADO: "VER_ESTADO_JURIDICO_EMPLEADO",
  CAMBIAR_ESTADO_JURIDICO_EMPLEADO: "CAMBIAR_ESTADO_JURIDICO_EMPLEADO",
  VER_ESTADO_JURIDICO_PROVEEDOR: "VER_ESTADO_JURIDICO_PROVEEDOR",
  CAMBIAR_ESTADO_JURIDICO_PROVEEDOR: "CAMBIAR_ESTADO_JURIDICO_PROVEEDOR",
  VER_ESTADO_JURIDICO_CONFECCIONISTA: "VER_ESTADO_JURIDICO_CONFECCIONISTA",
  CAMBIAR_ESTADO_JURIDICO_CONFECCIONISTA:
    "CAMBIAR_ESTADO_JURIDICO_CONFECCIONISTA",
  VER_ESTADO_JURIDICO_EMPAQUE: "VER_ESTADO_JURIDICO_EMPAQUE",
  CAMBIAR_ESTADO_JURIDICO_EMPAQUE: "CAMBIAR_ESTADO_JURIDICO_EMPAQUE",
  VER_HISTORIAL_ESTADO_JURIDICO: "VER_HISTORIAL_ESTADO_JURIDICO",
  // Confeccionistas
  CREAR_CONFECCIONISTA: "CREAR_CONFECCIONISTA",
  EDITAR_CONFECCIONISTA: "EDITAR_CONFECCIONISTA",
  ELIMINAR_CONFECCIONISTA: "ELIMINAR_CONFECCIONISTA",
  VER_CONFECCIONISTA: "VER_CONFECCIONISTA",
  ASIGNAR_CONFECCIONISTA: "ASIGNAR_CONFECCIONISTA",
  // Cotizaciones
  CREAR_COTIZACION: "CREAR_COTIZACION",
  EDITAR_COTIZACION: "EDITAR_COTIZACION",
  ELIMINAR_COTIZACION: "ELIMINAR_COTIZACION",
  VER_COTIZACION: "VER_COTIZACION",
  DESCARGAR_COTIZACION: "DESCARGAR_COTIZACION",
  // Notificaciones
  VER_NOTIFICACION: "VER_NOTIFICACION",
  ELIMINAR_NOTIFICACION: "ELIMINAR_NOTIFICACION",
  // Accounting - new modules
  VER_CONCILIACION_BANCARIA: "VER_CONCILIACION_BANCARIA",
  CREAR_CONCILIACION_BANCARIA: "CREAR_CONCILIACION_BANCARIA",
  CERRAR_CONCILIACION_BANCARIA: "CERRAR_CONCILIACION_BANCARIA",
  VER_FACTORING: "VER_FACTORING",
  CREAR_FACTORING: "CREAR_FACTORING",
  VER_RETENCIONES: "VER_RETENCIONES",
  GESTIONAR_RETENCIONES: "GESTIONAR_RETENCIONES",
  VER_RECIBO_CAJA: "VER_RECIBO_CAJA",
  CREAR_RECIBO_CAJA: "CREAR_RECIBO_CAJA",
  ANULAR_RECIBO_CAJA: "ANULAR_RECIBO_CAJA",
  VER_CARTERA: "VER_CARTERA",
  EXPORTAR_CARTERA: "EXPORTAR_CARTERA",
  // RH - new modules
  VER_PROVISIONES_NOMINA: "VER_PROVISIONES_NOMINA",
  CREAR_PROVISIONES_NOMINA: "CREAR_PROVISIONES_NOMINA",
  VER_PERMISOS_EMPLEADO: "VER_PERMISOS_EMPLEADO",
  APROBAR_PERMISO_EMPLEADO: "APROBAR_PERMISO_EMPLEADO",
  VER_PILA: "VER_PILA",
  GENERAR_PILA: "GENERAR_PILA",
  // Historial
  VER_HISTORIAL_ESTADO: "VER_HISTORIAL_ESTADO",
  // Moldería
  VER_MOLDERIA: "VER_MOLDERIA",
  CREAR_MOLDERIA: "CREAR_MOLDERIA",
  EDITAR_MOLDERIA: "EDITAR_MOLDERIA",
  ELIMINAR_MOLDERIA: "ELIMINAR_MOLDERIA",
} as const;

export const permissionValues = [
  // Pedidos
  "CREAR_PEDIDO",
  "EDITAR_PEDIDO",
  "ELIMINAR_PEDIDO",
  "VER_PEDIDO",
  "CAMBIAR_ESTADO_PEDIDO",
  // Diseños
  "CREAR_DISEÑO",
  "EDITAR_DISEÑO",
  "ELIMINAR_DISEÑO",
  "VER_DISEÑO",
  "EDITAR_IMAGEN",
  "ASIGNAR_DISEÑO",
  "CAMBIAR_ESTADO_DISEÑO",
  // Pagos
  "CREAR_PAGO",
  "EDITAR_PAGO",
  "APROBAR_PAGO",
  "VER_PAGO",
  // Inventario
  "CREAR_ITEM_INVENTARIO",
  "EDITAR_ITEM_INVENTARIO",
  "ELIMINAR_ITEM_INVENTARIO",
  "VER_ITEM_INVENTARIO",
  "REGISTRAR_ENTRADA",
  "REGISTRAR_SALIDA",
  "VER_INVENTARIO",
  // Empaque
  "CREAR_EMPAQUE",
  "EDITAR_EMPAQUE",
  "ELIMINAR_EMPAQUE",
  "MARCAR_EMPAQUE",
  "VER_EMPAQUE",
  // Compras
  "CREAR_ORDEN_COMPRA",
  "ASOCIAR_PROVEEDOR",
  // Proveedores
  "CREAR_PROVEEDOR",
  "EDITAR_PROVEEDOR",
  "ELIMINAR_PROVEEDOR",
  "VER_PROVEEDOR",
  // Clientes
  "CREAR_CLIENTE",
  "EDITAR_CLIENTE",
  "ELIMINAR_CLIENTE",
  "VER_CLIENTE",
  "VER_ESTADO_JURIDICO_CLIENTE",
  "CAMBIAR_ESTADO_JURIDICO_CLIENTE",
  "VER_ESTADO_JURIDICO_EMPLEADO",
  "CAMBIAR_ESTADO_JURIDICO_EMPLEADO",
  "VER_ESTADO_JURIDICO_PROVEEDOR",
  "CAMBIAR_ESTADO_JURIDICO_PROVEEDOR",
  "VER_ESTADO_JURIDICO_CONFECCIONISTA",
  "CAMBIAR_ESTADO_JURIDICO_CONFECCIONISTA",
  "VER_ESTADO_JURIDICO_EMPAQUE",
  "CAMBIAR_ESTADO_JURIDICO_EMPAQUE",
  "VER_HISTORIAL_ESTADO_JURIDICO",
  // Confeccionistas
  "CREAR_CONFECCIONISTA",
  "EDITAR_CONFECCIONISTA",
  "ELIMINAR_CONFECCIONISTA",
  "VER_CONFECCIONISTA",
  "ASIGNAR_CONFECCIONISTA",
  // Cotizaciones
  "CREAR_COTIZACION",
  "EDITAR_COTIZACION",
  "ELIMINAR_COTIZACION",
  "VER_COTIZACION",
  "DESCARGAR_COTIZACION",
  // Notificaciones
  "VER_NOTIFICACION",
  "ELIMINAR_NOTIFICACION",
  // Accounting - new modules
  "VER_CONCILIACION_BANCARIA",
  "CREAR_CONCILIACION_BANCARIA",
  "CERRAR_CONCILIACION_BANCARIA",
  "VER_FACTORING",
  "CREAR_FACTORING",
  "VER_RETENCIONES",
  "GESTIONAR_RETENCIONES",
  "VER_RECIBO_CAJA",
  "CREAR_RECIBO_CAJA",
  "ANULAR_RECIBO_CAJA",
  "VER_CARTERA",
  "EXPORTAR_CARTERA",
  // Caja Menor
  "VER_CAJA_MENOR",
  "CREAR_CAJA_MENOR",
  "GESTIONAR_CAJA_MENOR",
  // Estado de Resultados
  "VER_ESTADO_RESULTADOS",
  // RH - new modules
  "VER_PROVISIONES_NOMINA",
  "CREAR_PROVISIONES_NOMINA",
  "VER_PERMISOS_EMPLEADO",
  "APROBAR_PERMISO_EMPLEADO",
  "VER_PILA",
  "GENERAR_PILA",
  // Historial
  "VER_HISTORIAL_ESTADO",
  // Moldería
  "VER_MOLDERIA",
  "CREAR_MOLDERIA",
  "EDITAR_MOLDERIA",
  "ELIMINAR_MOLDERIA",
] as const;

export const PermissionEnum = z.enum(permissionValues);
Object.defineProperty(PermissionEnum, "enumValues", {
  value: permissionValues,
});

/* ========================= */
/*     ORDER ENUMS          */
/* ========================= */

export const OrderType = {
  VN: "VN",
  VI: "VI",
  VT: "VT",
  VW: "VW",
} as const;

export const orderTypeValues = ["VN", "VI", "VT", "VW"] as const;

export const OrderTypeEnum = z.enum(orderTypeValues);
Object.defineProperty(OrderTypeEnum, "enumValues", {
  value: orderTypeValues,
});

export const OrderKind = {
  NUEVO: "NUEVO",
  COMPLETACION: "COMPLETACION",
  REFERENTE: "REFERENTE",
} as const;

export const orderKindValues = ["NUEVO", "COMPLETACION", "REFERENTE"] as const;

export const OrderKindEnum = z.enum(orderKindValues);
Object.defineProperty(OrderKindEnum, "enumValues", {
  value: orderKindValues,
});

export const OrderStatus = {
  PENDIENTE: "PENDIENTE",
  PENDIENTE_CONTABILIDAD: "PENDIENTE_CONTABILIDAD",
  APROBADO_CONTABILIDAD: "APROBADO_CONTABILIDAD",
  APROBACION: "APROBACION",
  PROGRAMACION: "PROGRAMACION",
  PRODUCCION: "PRODUCCION",
  ATRASADO: "ATRASADO",
  FINALIZADO: "FINALIZADO",
  ENTREGADO: "ENTREGADO",
  CANCELADO: "CANCELADO",
} as const;

export const orderStatusValues = [
  "PENDIENTE",
  "PENDIENTE_CONTABILIDAD",
  "APROBADO_CONTABILIDAD",
  "APROBACION",
  "PROGRAMACION",
  "PRODUCCION",
  "ATRASADO",
  "FINALIZADO",
  "ENTREGADO",
  "CANCELADO",
] as const;

export const OrderStatusEnum = z.enum(orderStatusValues);
Object.defineProperty(OrderStatusEnum, "enumValues", {
  value: orderStatusValues,
});

export const OrderItemStatus = {
  PENDIENTE: "PENDIENTE",
  APROBACION: "APROBACION",
  APROBACION_ACTUALIZACION: "APROBACION_ACTUALIZACION",
  APROBADO_CAMBIO: "APROBADO_CAMBIO",
  RECHAZADO_CAMBIO: "RECHAZADO_CAMBIO",
  PENDIENTE_PRODUCCION: "PENDIENTE_PRODUCCION",
  PENDIENTE_PRODUCCION_ACTUALIZACION: "PENDIENTE_PRODUCCION_ACTUALIZACION",
  MONTAJE: "MONTAJE",
  IMPRESION: "IMPRESION",
  SUBLIMACION: "SUBLIMACION",
  CORTE_MANUAL: "CORTE_MANUAL",
  CORTE_LASER: "CORTE_LASER",
  PENDIENTE_CONFECCION: "PENDIENTE_CONFECCION",
  CONFECCION: "CONFECCION",
  EN_BODEGA: "EN_BODEGA",
  EMPAQUE: "EMPAQUE",
  ENVIADO: "ENVIADO",
  COMPLETADO: "COMPLETADO",
  CANCELADO: "CANCELADO",
} as const;

export const orderItemStatusValues = [
  "PENDIENTE",
  "APROBACION",
  "APROBACION_ACTUALIZACION",
  "APROBADO_CAMBIO",
  "RECHAZADO_CAMBIO",
  "PENDIENTE_PRODUCCION",
  "PENDIENTE_PRODUCCION_ACTUALIZACION",
  "MONTAJE",
  "IMPRESION",
  "SUBLIMACION",
  "CORTE_MANUAL",
  "CORTE_LASER",
  "PENDIENTE_CONFECCION",
  "CONFECCION",
  "EN_BODEGA",
  "EMPAQUE",
  "ENVIADO",
  "COMPLETADO",
  "CANCELADO",
] as const;

export const OrderItemStatusEnum = z.enum(orderItemStatusValues);
Object.defineProperty(OrderItemStatusEnum, "enumValues", {
  value: orderItemStatusValues,
});

export const DesignType = {
  PRODUCCION: "PRODUCCION",
  COMPRA: "COMPRA",
  BODEGA: "BODEGA",
} as const;

export const designTypeValues = ["PRODUCCION", "COMPRA", "BODEGA"] as const;

export const DesignTypeEnum = z.enum(designTypeValues);
Object.defineProperty(DesignTypeEnum, "enumValues", {
  value: designTypeValues,
});

export const ProductionTechnique = {
  SUBLIMACION: "SUBLIMACION",
  FONDO_ENTERO: "FONDO_ENTERO",
} as const;

export const productionTechniqueValues = [
  "SUBLIMACION",
  "FONDO_ENTERO",
] as const;

export const ProductionTechniqueEnum = z.enum(productionTechniqueValues);
Object.defineProperty(ProductionTechniqueEnum, "enumValues", {
  value: productionTechniqueValues,
});

export const Position = {
  JUGADOR: "JUGADOR",
  ARQUERO: "ARQUERO",
  CAPITAN: "CAPITAN",
  JUEZ: "JUEZ",
  ENTRENADOR: "ENTRENADOR",
  LIBERO: "LIBERO",
  ADICIONAL: "ADICIONAL",
} as const;

export const positionValues = [
  "JUGADOR",
  "ARQUERO",
  "CAPITAN",
  "JUEZ",
  "ENTRENADOR",
  "LIBERO",
  "ADICIONAL",
] as const;

export const PositionEnum = z.enum(positionValues);
Object.defineProperty(PositionEnum, "enumValues", {
  value: positionValues,
});

export const SockLength = {
  LARGA: "LARGA",
  TRES_CUARTOS: "TRES_CUARTOS",
  TALONERA: "TALONERA",
} as const;

export const sockLengthValues = ["LARGA", "TRES_CUARTOS", "TALONERA"] as const;

export const SockLengthEnum = z.enum(sockLengthValues);
Object.defineProperty(SockLengthEnum, "enumValues", {
  value: sockLengthValues,
});

/* ========================= */
/*     PAYMENT ENUMS        */
/* ========================= */

export const PaymentMethod = {
  EFECTIVO: "EFECTIVO",
  TRANSFERENCIA: "TRANSFERENCIA",
  CREDITO: "CREDITO",
} as const;

export const paymentMethodValues = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "CREDITO",
] as const;

export const PaymentMethodEnum = z.enum(paymentMethodValues);
Object.defineProperty(PaymentMethodEnum, "enumValues", {
  value: paymentMethodValues,
});

export const PaymentStatus = {
  PENDIENTE: "PENDIENTE",
  PARCIAL: "PARCIAL",
  PAGADO: "PAGADO",
  ANULADO: "ANULADO",
  CONFIRMADO_CAJA: "CONFIRMADO_CAJA",
} as const;

export const paymentStatusValues = [
  "PENDIENTE",
  "PARCIAL",
  "PAGADO",
  "ANULADO",
  "CONFIRMADO_CAJA",
] as const;

export const PaymentStatusEnum = z.enum(paymentStatusValues);
Object.defineProperty(PaymentStatusEnum, "enumValues", {
  value: paymentStatusValues,
});

/* ========================= */
/*     INVENTORY ENUMS      */
/* ========================= */

export const InventoryLocation = {
  BODEGA_PRINCIPAL: "BODEGA_PRINCIPAL",
  TIENDA: "TIENDA",
} as const;

export const inventoryLocationValues = ["BODEGA_PRINCIPAL", "TIENDA"] as const;

export const InventoryLocationEnum = z.enum(inventoryLocationValues);
Object.defineProperty(InventoryLocationEnum, "enumValues", {
  value: inventoryLocationValues,
});

export const InventoryCategoryType = {
  MATERIA_PRIMA: "MATERIA_PRIMA",
  TELAS: "TELAS",
  EMPAQUES: "EMPAQUES",
  INSUMOS_PRODUCCION: "INSUMOS_PRODUCCION",
  INSUMOS_VARIOS: "INSUMOS_VARIOS",
  PAPELERIA: "PAPELERIA",
  ASEO: "ASEO",
  REPUESTOS: "REPUESTOS",
  REVENTA: "REVENTA",
} as const;

export const inventoryCategoryTypeValues = [
  "MATERIA_PRIMA",
  "TELAS",
  "EMPAQUES",
  "INSUMOS_PRODUCCION",
  "INSUMOS_VARIOS",
  "PAPELERIA",
  "ASEO",
  "REPUESTOS",
  "REVENTA",
] as const;

export const InventoryCategoryTypeEnum = z.enum(inventoryCategoryTypeValues);
Object.defineProperty(InventoryCategoryTypeEnum, "enumValues", {
  value: inventoryCategoryTypeValues,
});

export const WarehousePurpose = {
  GENERAL: "GENERAL",
  MATERIA_PRIMA: "MATERIA_PRIMA",
  PRODUCCION: "PRODUCCION",
  PRODUCTO_TERMINADO: "PRODUCTO_TERMINADO",
  TRANSITO: "TRANSITO",
} as const;

export const warehousePurposeValues = [
  "GENERAL",
  "MATERIA_PRIMA",
  "PRODUCCION",
  "PRODUCTO_TERMINADO",
  "TRANSITO",
] as const;

export const WarehousePurposeEnum = z.enum(warehousePurposeValues);
Object.defineProperty(WarehousePurposeEnum, "enumValues", {
  value: warehousePurposeValues,
});

export const WarehouseTransferStatus = {
  PENDIENTE: "PENDIENTE",
  APROBADA: "APROBADA",
  RECHAZADA: "RECHAZADA",
} as const;

export const warehouseTransferStatusValues = [
  "PENDIENTE",
  "APROBADA",
  "RECHAZADA",
] as const;

export const WarehouseTransferStatusEnum = z.enum(
  warehouseTransferStatusValues,
);
Object.defineProperty(WarehouseTransferStatusEnum, "enumValues", {
  value: warehouseTransferStatusValues,
});

export const StockMovementType = {
  ENTRADA: "ENTRADA",
  SALIDA: "SALIDA",
  TRASLADO: "TRASLADO",
  AJUSTE_POSITIVO: "AJUSTE_POSITIVO",
  AJUSTE_NEGATIVO: "AJUSTE_NEGATIVO",
  DEVOLUCION: "DEVOLUCION",
} as const;

export const stockMovementTypeValues = [
  "ENTRADA",
  "SALIDA",
  "TRASLADO",
  "AJUSTE_POSITIVO",
  "AJUSTE_NEGATIVO",
  "DEVOLUCION",
] as const;

export const StockMovementTypeEnum = z.enum(stockMovementTypeValues);
Object.defineProperty(StockMovementTypeEnum, "enumValues", {
  value: stockMovementTypeValues,
});

export const StockMovementReason = {
  PRODUCCION: "PRODUCCION",
  VENTA: "VENTA",
  DESPACHO_CONFECCIONISTA: "DESPACHO_CONFECCIONISTA",
  COMPRA_PROVEEDOR: "COMPRA_PROVEEDOR",
  AJUSTE_INVENTARIO: "AJUSTE_INVENTARIO",
  DEVOLUCION_PROVEEDOR: "DEVOLUCION_PROVEEDOR",
  DEVOLUCION_CLIENTE: "DEVOLUCION_CLIENTE",
  TRASLADO_INTERNO: "TRASLADO_INTERNO",
  MUESTRA: "MUESTRA",
  BAJA: "BAJA",
  OTRO: "OTRO",
} as const;

export const stockMovementReasonValues = [
  "PRODUCCION",
  "VENTA",
  "DESPACHO_CONFECCIONISTA",
  "COMPRA_PROVEEDOR",
  "AJUSTE_INVENTARIO",
  "DEVOLUCION_PROVEEDOR",
  "DEVOLUCION_CLIENTE",
  "TRASLADO_INTERNO",
  "MUESTRA",
  "BAJA",
  "OTRO",
] as const;

export const StockMovementReasonEnum = z.enum(stockMovementReasonValues);
Object.defineProperty(StockMovementReasonEnum, "enumValues", {
  value: stockMovementReasonValues,
});

export const StockMovementReferenceType = {
  ORDER_ITEM: "ORDER_ITEM",
  PURCHASE_ORDER: "PURCHASE_ORDER",
  CONFECTIONIST: "CONFECTIONIST",
  MANUAL: "MANUAL",
  SHIPMENT: "SHIPMENT",
} as const;

export const stockMovementReferenceTypeValues = [
  "ORDER_ITEM",
  "PURCHASE_ORDER",
  "CONFECTIONIST",
  "MANUAL",
  "SHIPMENT",
] as const;

export const StockMovementReferenceTypeEnum = z.enum(
  stockMovementReferenceTypeValues,
);
Object.defineProperty(StockMovementReferenceTypeEnum, "enumValues", {
  value: stockMovementReferenceTypeValues,
});

/* ========================= */
/*     SHIPMENT ENUMS       */
/* ========================= */

export const ShipmentMode = {
  INTERNAL: "INTERNAL",
  CLIENT: "CLIENT",
} as const;

export const shipmentModeValues = ["INTERNAL", "CLIENT"] as const;

export const ShipmentModeEnum = z.enum(shipmentModeValues);
Object.defineProperty(ShipmentModeEnum, "enumValues", {
  value: shipmentModeValues,
});

export const ShipmentPaymentStatus = {
  PAGADO: "PAGADO",
  PENDIENTE: "PENDIENTE",
  NA: "NA",
} as const;

export const shipmentPaymentStatusValues = [
  "PAGADO",
  "PENDIENTE",
  "NA",
] as const;

export const ShipmentPaymentStatusEnum = z.enum(shipmentPaymentStatusValues);
Object.defineProperty(ShipmentPaymentStatusEnum, "enumValues", {
  value: shipmentPaymentStatusValues,
});

export const ShipmentDocumentType = {
  F: "F",
  R: "R",
} as const;

export const shipmentDocumentTypeValues = ["F", "R"] as const;

export const ShipmentDocumentTypeEnum = z.enum(shipmentDocumentTypeValues);
Object.defineProperty(ShipmentDocumentTypeEnum, "enumValues", {
  value: shipmentDocumentTypeValues,
});

export const ShipmentDocumentRef = {
  RECIBO_CAJA: "RECIBO_CAJA",
  PREFACTURA: "PREFACTURA",
} as const;

export const shipmentDocumentRefValues = ["RECIBO_CAJA", "PREFACTURA"] as const;

export const ShipmentDocumentRefEnum = z.enum(shipmentDocumentRefValues);
Object.defineProperty(ShipmentDocumentRefEnum, "enumValues", {
  value: shipmentDocumentRefValues,
});

export const ShipmentEmailMode = {
  REGISTRADO: "REGISTRADO",
  NUEVO: "NUEVO",
  AMBOS: "AMBOS",
} as const;

export const shipmentEmailModeValues = [
  "REGISTRADO",
  "NUEVO",
  "AMBOS",
] as const;

export const ShipmentEmailModeEnum = z.enum(shipmentEmailModeValues);
Object.defineProperty(ShipmentEmailModeEnum, "enumValues", {
  value: shipmentEmailModeValues,
});

/* ========================= */
/*   MOLDING INSUMO STATUS   */
/* ========================= */

export const MoldingInsumoStatus = {
  PENDIENTE: "PENDIENTE",
  SOLICITADO_COMPRAS: "SOLICITADO_COMPRAS",
  EN_STOCK: "EN_STOCK",
  DESPACHADO_CONFECCION: "DESPACHADO_CONFECCION",
  COMPLETADO: "COMPLETADO",
} as const;

export const moldingInsumoStatusValues = [
  "PENDIENTE",
  "SOLICITADO_COMPRAS",
  "EN_STOCK",
  "DESPACHADO_CONFECCION",
  "COMPLETADO",
] as const;

export const MoldingInsumoStatusEnum = z.enum(moldingInsumoStatusValues);
Object.defineProperty(MoldingInsumoStatusEnum, "enumValues", {
  value: moldingInsumoStatusValues,
});

/* ========================= */
/*      MES ENUMS            */
/* ========================= */

export const MesPriority = {
  URGENTE: "URGENTE",
  NORMAL: "NORMAL",
  BAJA: "BAJA",
} as const;

export const mesPriorityValues = ["URGENTE", "NORMAL", "BAJA"] as const;

export const MesPriorityEnum = z.enum(mesPriorityValues);
Object.defineProperty(MesPriorityEnum, "enumValues", {
  value: mesPriorityValues,
});

export const MesQueueStatus = {
  EN_COLA: "EN_COLA",
  EN_PROCESO: "EN_PROCESO",
  COMPLETADO: "COMPLETADO",
} as const;

export const mesQueueStatusValues = [
  "EN_COLA",
  "EN_PROCESO",
  "COMPLETADO",
] as const;

export const MesQueueStatusEnum = z.enum(mesQueueStatusValues);
Object.defineProperty(MesQueueStatusEnum, "enumValues", {
  value: mesQueueStatusValues,
});

export const MesAssignmentStatus = {
  ASIGNADO: "ASIGNADO",
  EN_PROCESO: "EN_PROCESO",
  COMPLETADO: "COMPLETADO",
  PAUSADO: "PAUSADO",
} as const;

export const mesAssignmentStatusValues = [
  "ASIGNADO",
  "EN_PROCESO",
  "COMPLETADO",
  "PAUSADO",
] as const;

export const MesAssignmentStatusEnum = z.enum(mesAssignmentStatusValues);
Object.defineProperty(MesAssignmentStatusEnum, "enumValues", {
  value: mesAssignmentStatusValues,
});

export const MesRepoItemType = {
  PIEZA: "PIEZA",
  PRENDA: "PRENDA",
} as const;

export const mesRepoItemTypeValues = ["PIEZA", "PRENDA"] as const;

export const MesRepoItemTypeEnum = z.enum(mesRepoItemTypeValues);
Object.defineProperty(MesRepoItemTypeEnum, "enumValues", {
  value: mesRepoItemTypeValues,
});

export const MesRepoReason = {
  FALTANTE: "FALTANTE",
  DAÑO: "DAÑO",
  INCORRECTO: "INCORRECTO",
} as const;

export const pettyCashTransactionTypeValues = [
  "EXPENSE",
  "REPLENISHMENT",
  "OPENING",
  "ADJUSTMENT",
] as const;
export type PettyCashTransactionType =
  (typeof pettyCashTransactionTypeValues)[number];
export const PettyCashTransactionTypeEnum = z.enum(
  pettyCashTransactionTypeValues,
);
Object.defineProperty(PettyCashTransactionTypeEnum, "enumValues", {
  value: pettyCashTransactionTypeValues,
});

export const pettyCashFundStatusValues = ["ACTIVE", "INACTIVE"] as const;
export type PettyCashFundStatus = (typeof pettyCashFundStatusValues)[number];
export const PettyCashFundStatusEnum = z.enum(pettyCashFundStatusValues);
Object.defineProperty(PettyCashFundStatusEnum, "enumValues", {
  value: pettyCashFundStatusValues,
});

export const mesRepoReasonValues = ["FALTANTE", "DAÑO", "INCORRECTO"] as const;

export const MesRepoReasonEnum = z.enum(mesRepoReasonValues);
Object.defineProperty(MesRepoReasonEnum, "enumValues", {
  value: mesRepoReasonValues,
});

/* ===========================
   MES — TAGS DE DISEÑO
=========================== */
export const mesItemTagValues = [
  "REQUIERE_PICADA",
  "URGENTE",
  "CONTROL_CALIDAD_EXTRA",
  "MATERIAL_ESPECIAL",
  "SEGUNDA_REVISION",
  "DESPACHO_PARCIAL",
] as const;
export type MesItemTag = (typeof mesItemTagValues)[number];
export const MesItemTagEnum = z.enum(mesItemTagValues);
Object.defineProperty(MesItemTagEnum, "enumValues", { value: mesItemTagValues });

/* ===========================
   MES — ENVÍOS ENTRE ÁREAS
=========================== */
export const mesShipmentAreaValues = [
  "VIOMAR",
  "INTEGRACION",
  "CONFECCION_EXTERNA",
  "DESPACHO",
] as const;
export type MesShipmentArea = (typeof mesShipmentAreaValues)[number];
export const MesShipmentAreaEnum = z.enum(mesShipmentAreaValues);
Object.defineProperty(MesShipmentAreaEnum, "enumValues", { value: mesShipmentAreaValues });

export const mesTransportTypeValues = [
  "MENSAJERO",
  "CONDUCTOR_PROPIO",
  "LINEA_TERCERO",
] as const;
export type MesTransportType = (typeof mesTransportTypeValues)[number];
export const MesTransportTypeEnum = z.enum(mesTransportTypeValues);
Object.defineProperty(MesTransportTypeEnum, "enumValues", { value: mesTransportTypeValues });

export const mesEnvioStatusValues = [
  "CREADO",
  "EN_RUTA",
  "ENTREGADO",
  "RETORNADO",
  "INCIDENTE",
] as const;
export type MesEnvioStatus = (typeof mesEnvioStatusValues)[number];
export const MesEnvioStatusEnum = z.enum(mesEnvioStatusValues);
Object.defineProperty(MesEnvioStatusEnum, "enumValues", { value: mesEnvioStatusValues });
