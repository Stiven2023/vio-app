import type { identificationTypeValues, taxRegimeValues } from "@/src/db/enums";

export type SupplierFormPrefill = {
  name?: string;
  identificationType?: (typeof identificationTypeValues)[number];
  identification?: string;
  dv?: string;
  branch?: string;
  taxRegime?: (typeof taxRegimeValues)[number];
  contactName?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  country?: string;
  department?: string;
  city?: string;
  intlDialCode?: string;
  mobile?: string;
  fullMobile?: string;
  localDialCode?: string;
  landline?: string;
  extension?: string;
  fullLandline?: string;
  hasCredit?: boolean;
  promissoryNoteNumber?: string;
  promissoryNoteDate?: string;
  bankCertificateUrl?: string;
};
