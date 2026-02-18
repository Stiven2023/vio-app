import type { identificationTypeEnum, taxRegimeEnum } from "@/src/db/schema";
import type { InferSelectModel } from "drizzle-orm";

export type SupplierFormPrefill = {
  name?: string;
  identificationType?: (typeof identificationTypeEnum.enumValues)[number];
  identification?: string;
  dv?: string;
  branch?: string;
  taxRegime?: (typeof taxRegimeEnum.enumValues)[number];
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
};
