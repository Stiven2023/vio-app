export type DocumentFieldKey =
  | "identityDocumentUrl"
  | "rutDocumentUrl"
  | "commerceChamberDocumentUrl"
  | "passportDocumentUrl"
  | "taxCertificateDocumentUrl"
  | "companyIdDocumentUrl";

export type RequiredDocumentRule = {
  field: DocumentFieldKey;
  label: string;
};

const REQUIRED_DOCUMENTS_BY_IDENTIFICATION_TYPE: Record<string, RequiredDocumentRule[]> = {
  CC: [
    { field: "identityDocumentUrl", label: "Cédula del titular" },
    { field: "rutDocumentUrl", label: "RUT" },
  ],
  NIT: [
    { field: "rutDocumentUrl", label: "RUT de la empresa" },
    { field: "commerceChamberDocumentUrl", label: "Cámara de Comercio" },
    {
      field: "identityDocumentUrl",
      label: "Cédula del representante legal",
    },
  ],
  CE: [
    {
      field: "identityDocumentUrl",
      label: "ID Extranjero (Cédula de Extranjería)",
    },
    { field: "passportDocumentUrl", label: "Pasaporte" },
  ],
  PAS: [
    { field: "identityDocumentUrl", label: "Documento de Identidad" },
    { field: "passportDocumentUrl", label: "Pasaporte" },
  ],
  EMPRESA_EXTERIOR: [
    {
      field: "passportDocumentUrl",
      label: "Pasaporte del Representante",
    },
    {
      field: "taxCertificateDocumentUrl",
      label: "Certificado Tributario",
    },
    { field: "companyIdDocumentUrl", label: "ID de la Empresa" },
  ],
};

export function getRequiredDocumentsByIdentificationType(
  identificationType: string,
): RequiredDocumentRule[] {
  return REQUIRED_DOCUMENTS_BY_IDENTIFICATION_TYPE[identificationType] ?? [];
}

export function getMissingRequiredDocumentMessage(
  identificationType: string,
  payload: Record<string, unknown>,
): string | null {
  const requiredDocuments = getRequiredDocumentsByIdentificationType(
    identificationType,
  );

  for (const doc of requiredDocuments) {
    const value = String(payload[doc.field] ?? "").trim();
    if (!value) {
      return `${doc.label} es requerido`;
    }
  }

  return null;
}
