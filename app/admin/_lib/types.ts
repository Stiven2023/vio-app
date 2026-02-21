export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

export type Role = { id: string; name: string };
export type Permission = { id: string; name: string };

export type AdminUser = {
  id: string;
  email: string;
  emailVerified: boolean | null;
  isActive: boolean | null;
  createdAt: string | null;
};

export type AdminUserOption = { id: string; email: string };

export type Employee = {
  id: string;
  employeeCode: string | null;
  userId: string | null;
  name: string;
  identificationType: string;
  identification: string;
  dv: string | null;
  email: string;
  intlDialCode: string | null;
  mobile: string | null;
  fullMobile: string | null;
  landline: string | null;
  extension: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  identityDocumentUrl: string | null;
  hojaDeVidaUrl: string | null;
  certificadoLaboralUrl: string | null;
  certificadoEstudiosUrl: string | null;
  epsCertificateUrl: string | null;
  pensionCertificateUrl: string | null;
  bankCertificateUrl: string | null;
  roleId: string | null;
  isActive: boolean | null;
  createdAt: string | null;
};

export type Client = {
  id: string;
  // --- CÓDIGO Y TIPO ---
  clientCode: string;
  clientType: string;
  name: string;
  // --- IDENTIFICACIÓN Y TIPO DE DOCUMENTO (determinan los documentos requeridos) ---
  identificationType: string;
  identification: string;
  dv: string | null;
  branch: string | null;
  // --- DOCUMENTOS (determinados por identificationType) ---
  identityDocumentUrl: string | null;
  rutDocumentUrl: string | null;
  commerceChamberDocumentUrl: string | null;
  passportDocumentUrl: string | null;
  taxCertificateDocumentUrl: string | null;
  companyIdDocumentUrl: string | null;
  // --- INFORMACIÓN FISCAL Y CONTACTO ---
  taxRegime: string;
  contactName: string;
  email: string;
  // --- UBICACIÓN GEOGRÁFICA ---
  address: string;
  postalCode: string | null;
  country: string | null;
  department: string | null;
  city: string | null;
  // --- TELÉFONOS Y MARCACIÓN ---
  intlDialCode: string | null;
  mobile: string | null;
  fullMobile: string | null;
  localDialCode: string | null;
  landline: string | null;
  extension: string | null;
  fullLandline: string | null;
  // --- ESTADO Y CRÉDITO ---
  status: string | null;
  priceClientType: string;
  isActive: boolean | null;
  hasCredit: boolean | null;
  promissoryNoteNumber: string | null;
  promissoryNoteDate: string | null;
  createdAt: string | null;
  // --- ESTADO JURÍDICO ---
  legalStatus: "VIGENTE" | "EN_REVISION" | "BLOQUEADO" | null;
};

export type ClientLegalStatusRecord = {
  id: string;
  clientId: string;
  clientName: string;
  status: "VIGENTE" | "EN_REVISION" | "BLOQUEADO";
  notes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  changedFields: string | null; // JSON serializado de campos modificados
  createdAt: string | null;
};

export type LegalStatusRecord = {
  id: string;
  thirdPartyId: string;
  thirdPartyType: "CLIENTE" | "EMPLEADO" | "PROVEEDOR" | "CONFECCIONISTA" | "EMPACADOR";
  thirdPartyName: string;
  status: "VIGENTE" | "EN_REVISION" | "BLOQUEADO";
  notes: string | null;
  reviewedBy: string | null;
  changedFields: string | null; // JSON serializado de campos modificados
  createdAt: string | null;
};

export type Supplier = {
  id: string;
  supplierCode: string;
  name: string;
  identificationType: string;
  identification: string;
  dv: string | null;
  branch: string;
  taxRegime: string;
  contactName: string;
  email: string;
  address: string;
  postalCode: string | null;
  country: string;
  department: string;
  city: string;
  intlDialCode: string | null;
  mobile: string | null;
  fullMobile: string | null;
  localDialCode: string | null;
  landline: string | null;
  extension: string | null;
  fullLandline: string | null;
  isActive: boolean | null;
  hasCredit: boolean | null;
  promissoryNoteNumber: string | null;
  promissoryNoteDate: string | null;
  identityDocumentUrl: string | null;
  rutDocumentUrl: string | null;
  commerceChamberDocumentUrl: string | null;
  passportDocumentUrl: string | null;
  taxCertificateDocumentUrl: string | null;
  companyIdDocumentUrl: string | null;
  createdAt: string | null;
};

export type Confectionist = {
  id: string;
  confectionistCode: string;
  name: string;
  identificationType: string;
  identification: string;
  dv: string | null;
  type: string | null;
  taxRegime: string;
  contactName: string | null;
  email: string | null;
  intlDialCode: string | null;
  mobile: string | null;
  fullMobile: string | null;
  landline: string | null;
  extension: string | null;
  address: string;
  postalCode: string | null;
  country: string;
  department: string;
  city: string;
  isActive: boolean | null;
  identityDocumentUrl: string | null;
  rutDocumentUrl: string | null;
  commerceChamberDocumentUrl: string | null;
  passportDocumentUrl: string | null;
  taxCertificateDocumentUrl: string | null;
  companyIdDocumentUrl: string | null;
  createdAt: string | null;
};

export type Packer = {
  id: string;
  packerCode: string;
  name: string;
  identificationType: string;
  identification: string;
  dv: string | null;
  packerType: string | null;
  specialty: string | null;
  contactName: string | null;
  email: string | null;
  intlDialCode: string | null;
  mobile: string | null;
  fullMobile: string | null;
  landline: string | null;
  address: string;
  postalCode: string | null;
  city: string;
  department: string;
  isActive: boolean | null;
  dailyCapacity: number | null;
  identityDocumentUrl: string | null;
  rutDocumentUrl: string | null;
  commerceChamberDocumentUrl: string | null;
  passportDocumentUrl: string | null;
  taxCertificateDocumentUrl: string | null;
  companyIdDocumentUrl: string | null;
  createdAt: string | null;
};

export type RolePermission = {
  roleId: string | null;
  permissionId: string | null;
};
