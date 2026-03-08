import type { Dispatch, SetStateAction } from "react";

export type FormState = {
  clientType: string;
  priceClientType: string;
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
  hasCredit: boolean;
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
