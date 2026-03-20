import type { Dispatch, SetStateAction } from "react";

export type FormState = {
  clientType: string;
  name: string;
  identificationType: string;
  identification: string;
  dv: string;
  branch: string;
  taxRegime: string;
  contactName: string;
  email: string;
  address: string;
  postalCode: string;
  country: string;
  department: string;
  city: string;
  intlDialCode: string;
  mobile: string;
  localDialCode: string;
  landline: string;
  extension: string;
  municipalityFiscal: string;
  taxZone: "CONTINENTAL" | "FREE_ZONE" | "SAN_ANDRES" | "SPECIAL_REGIME";
  paymentType: "CASH" | "CREDIT";
  hasCredit: boolean;
  creditLimit: string;
  creditBackingType:
    | ""
    | "PROMISSORY_NOTE"
    | "PURCHASE_ORDER"
    | "VERBAL_AGREEMENT";
  promissoryNoteNumber: string;
  promissoryNoteDate: string;
  status: string;
  isActive: boolean;
  identityDocumentUrl: string;
  rutDocumentUrl: string;
  commerceChamberDocumentUrl: string;
  passportDocumentUrl: string;
  taxCertificateDocumentUrl: string;
  companyIdDocumentUrl: string;
};

export type FormErrors = Record<string, string>;
export type SetFormState = Dispatch<SetStateAction<FormState>>;
export type ClientFormPrefill = Partial<FormState>;
