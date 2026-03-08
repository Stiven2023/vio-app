/**
 * Determina qué documentos son necesarios basado en el tipo de identificación
 * 
 * CC (Cédula) → Persona Natural Nacional
 *   - Requiere: identityDocumentUrl (cédula), rutDocumentUrl (RUT)
 * 
 * NIT → Empresa Nacional (Persona Jurídica)
 *   - Requiere: rutDocumentUrl (RUT), commerceChamberDocumentUrl (Cámara de Comercio), 
 *             identityDocumentUrl (cédula del representante legal)
 * 
 * CE (Cédula de Extranjero) → Persona Natural Extranjera
 *   - Requiere: identityDocumentUrl (CE), passportDocumentUrl (Pasaporte/PPT)
 * 
 * PAS (Pasaporte) → Persona Natural Extranjera (Venezolano)
 *   - Requiere: identityDocumentUrl (Pasaporte), passportDocumentUrl (PPT adicional si existe)
 * 
 * EMPRESA_EXTERIOR → Empresa Extranjera (Persona Jurídica)
 *   - Requiere: passportDocumentUrl, taxCertificateDocumentUrl, companyIdDocumentUrl
 */

export type IdentificationType = "CC" | "NIT" | "CE" | "PAS" | "EMPRESA_EXTERIOR";

export interface RequiredDocuments {
  documents: string[];
  description: string;
  isNatural: boolean;
  isNational: boolean;
}

export function getRequiredDocumentsByIdentificationType(
  identificationType: IdentificationType
): RequiredDocuments {
  switch (identificationType) {
    case "CC":
      return {
        documents: ["identityDocumentUrl", "rutDocumentUrl"],
        description: "Persona Natural Nacional",
        isNatural: true,
        isNational: true,
      };

    case "NIT":
      return {
        documents: [
          "rutDocumentUrl",
          "commerceChamberDocumentUrl",
          "identityDocumentUrl",
        ],
        description: "Empresa Nacional (Persona Jurídica)",
        isNatural: false,
        isNational: true,
      };

    case "CE":
      return {
        documents: ["identityDocumentUrl", "passportDocumentUrl"],
        description: "Persona Natural Extranjera",
        isNatural: true,
        isNational: false,
      };

    case "PAS":
      return {
        documents: ["identityDocumentUrl", "passportDocumentUrl"],
        description: "Persona Natural Extranjera (Venezolano)",
        isNatural: true,
        isNational: false,
      };

    case "EMPRESA_EXTERIOR":
      return {
        documents: [
          "passportDocumentUrl",
          "taxCertificateDocumentUrl",
          "companyIdDocumentUrl",
        ],
        description: "Empresa Extranjera (Persona Jurídica)",
        isNatural: false,
        isNational: false,
      };

    default:
      return {
        documents: [],
        description: "Desconocido",
        isNatural: false,
        isNational: false,
      };
  }
}

/**
 * Valida si un cliente tiene todos los documentos requeridos
 */
export function validateRequiredDocuments(
  identificationType: IdentificationType,
  documents: Partial<Record<string, string | null | undefined>>
): { isValid: boolean; missingDocuments: string[] } {
  const required = getRequiredDocumentsByIdentificationType(identificationType);
  const missing = required.documents.filter((doc) => !documents[doc]);

  return {
    isValid: missing.length === 0,
    missingDocuments: missing,
  };
}
