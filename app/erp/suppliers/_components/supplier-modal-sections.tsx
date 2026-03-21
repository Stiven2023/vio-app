"use client";

import { Divider } from "@heroui/divider";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import {
  BsCreditCardFill,
  BsEnvelopeFill,
  BsGeoAltFill,
  BsInfoCircle,
  BsPersonFill,
  BsTelephoneFill,
} from "react-icons/bs";

export type SupplierSectionsFormState = {
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
  fullMobile: string;
  localDialCode: string;
  landline: string;
  extension: string;
  fullLandline: string;
  hasCredit: boolean;
  promissoryNoteNumber: string;
  promissoryNoteDate: string;
  isActive: boolean;
  identityDocumentUrl: string;
  rutDocumentUrl: string;
  commerceChamberDocumentUrl: string;
  passportDocumentUrl: string;
  taxCertificateDocumentUrl: string;
  companyIdDocumentUrl: string;
  bankCertificateUrl: string;
};

type Option = {
  value: string;
  label: string;
};

type CommonProps = {
  form: SupplierSectionsFormState;
  errors: Record<string, string>;
  onStringFieldChange: (
    field: keyof SupplierSectionsFormState,
    value: string,
  ) => void;
};

type IdentificationProps = CommonProps & {
  identificationTypes: Option[];
  onIdentificationInputChange: (value: string) => void;
};

type ContactProps = CommonProps & {
  taxRegimes: Option[];
};

export function SupplierIdentificationSection({
  form,
  errors,
  identificationTypes,
  onStringFieldChange,
  onIdentificationInputChange,
}: IdentificationProps) {
  const identificationHint =
    form.identificationType === "CC"
      ? "CC: numbers only, 6-10 digits"
      : form.identificationType === "NIT"
        ? "NIT: numbers only, 8-12 digits"
        : form.identificationType === "CE"
          ? "CE: alphanumeric, 5-15 characters"
          : form.identificationType === "PAS"
            ? "Passport: alphanumeric, 5-20 characters"
            : "Foreign company: at least 3 characters";

  const identificationInputMode =
    form.identificationType === "CC" || form.identificationType === "NIT"
      ? "numeric"
      : "text";

  return (
    <div className="space-y-4 py-4">
      <Input
        isRequired
        description="Required critical field"
        endContent={<span className="text-danger">*</span>}
        errorMessage={errors.name}
        isInvalid={Boolean(errors.name)}
        label="Third-party name"
        startContent={<BsPersonFill className="text-xl text-default-500" />}
        value={form.name}
        onValueChange={(value) => onStringFieldChange("name", value)}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select
          isRequired
          errorMessage={errors.identificationType}
          isInvalid={Boolean(errors.identificationType)}
          label="ID type"
          selectedKeys={
            form.identificationType ? [form.identificationType] : []
          }
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0];

            onStringFieldChange("identificationType", String(selected ?? ""));
          }}
        >
          {identificationTypes.map((type) => (
            <SelectItem key={type.value}>{type.label}</SelectItem>
          ))}
        </Select>

        <Input
          isRequired
          description={identificationHint}
          errorMessage={errors.identification}
          inputMode={identificationInputMode}
          isInvalid={Boolean(errors.identification)}
          label="Identification"
          value={form.identification}
          onValueChange={onIdentificationInputChange}
        />

        <Input
          label="Check digit (DV)"
          maxLength={1}
          value={form.dv}
          onValueChange={(value) => onStringFieldChange("dv", value)}
        />

        <Input
          label="Branch"
          value={form.branch}
          onValueChange={(value) => onStringFieldChange("branch", value)}
        />
      </div>
    </div>
  );
}

export function SupplierContactSection({
  form,
  errors,
  taxRegimes,
  onStringFieldChange,
}: ContactProps) {
  return (
    <div className="space-y-4 py-4">
      <Select
        isRequired
        errorMessage={errors.taxRegime}
        isInvalid={Boolean(errors.taxRegime)}
        label="Tax regime (VAT)"
        selectedKeys={form.taxRegime ? [form.taxRegime] : []}
        onSelectionChange={(keys) => {
          const selected = Array.from(keys)[0];

          onStringFieldChange("taxRegime", String(selected ?? ""));
        }}
      >
        {taxRegimes.map((regime) => (
          <SelectItem key={regime.value}>{regime.label}</SelectItem>
        ))}
      </Select>

      <Input
        isRequired
        description="Contact person at the company"
        endContent={<span className="text-danger">*</span>}
        errorMessage={errors.contactName}
        isInvalid={Boolean(errors.contactName)}
        label="Contact name"
        startContent={<BsPersonFill className="text-xl text-default-500" />}
        value={form.contactName}
        onValueChange={(value) => onStringFieldChange("contactName", value)}
      />

      <Input
        isRequired
        autoComplete="email"
        description="Required for billing"
        endContent={<span className="text-danger">*</span>}
        errorMessage={errors.email}
        inputMode="email"
        isInvalid={Boolean(errors.email)}
        label="Email"
        startContent={<BsEnvelopeFill className="text-xl text-default-500" />}
        type="text"
        value={form.email}
        onValueChange={(value) => onStringFieldChange("email", value)}
      />
    </div>
  );
}

export function SupplierLocationSection({
  form,
  errors,
  onStringFieldChange,
}: CommonProps) {
  return (
    <div className="space-y-4 py-4">
      <Input
        isRequired
        endContent={<span className="text-danger">*</span>}
        errorMessage={errors.address}
        isInvalid={Boolean(errors.address)}
        label="Address"
        startContent={<BsGeoAltFill className="text-xl text-default-500" />}
        value={form.address}
        onValueChange={(value) => onStringFieldChange("address", value)}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Postal code"
          value={form.postalCode}
          onValueChange={(value) => onStringFieldChange("postalCode", value)}
        />

        <Input
          label="Country"
          value={form.country}
          onValueChange={(value) => onStringFieldChange("country", value)}
        />

        <Input
          label="Department/State"
          value={form.department}
          onValueChange={(value) => onStringFieldChange("department", value)}
        />

        <Input
          label="City"
          value={form.city}
          onValueChange={(value) => onStringFieldChange("city", value)}
        />
      </div>
    </div>
  );
}

export function SupplierPhonesSection({
  form,
  errors,
  onStringFieldChange,
}: CommonProps) {
  return (
    <div className="space-y-4 py-4">
      <p className="text-sm text-default-600">Mobile (required)</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Input
          label="International code"
          placeholder="57"
          value={form.intlDialCode}
          onValueChange={(value) => onStringFieldChange("intlDialCode", value)}
        />

        <div className="md:col-span-2">
          <Input
            isRequired
            endContent={<span className="text-danger">*</span>}
            errorMessage={errors.mobile}
            isInvalid={Boolean(errors.mobile)}
            label="Mobile"
            startContent={
              <BsTelephoneFill className="text-xl text-default-500" />
            }
            value={form.mobile}
            onValueChange={(value) => onStringFieldChange("mobile", value)}
          />
        </div>
      </div>

      <Divider className="my-4" />

      <p className="text-sm text-default-600">Landline (optional)</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Input
          label="Local code"
          placeholder="4"
          value={form.localDialCode}
          onValueChange={(value) => onStringFieldChange("localDialCode", value)}
        />

        <div className="md:col-span-2">
          <Input
            label="Landline"
            value={form.landline}
            onValueChange={(value) => onStringFieldChange("landline", value)}
          />
        </div>

        <Input
          label="Extension"
          value={form.extension}
          onValueChange={(value) => onStringFieldChange("extension", value)}
        />
      </div>
    </div>
  );
}

type SupplierCreditProps = CommonProps & {
  onBooleanFieldChange: (
    field: keyof SupplierSectionsFormState,
    value: boolean,
  ) => void;
};

export function SupplierCreditSection({
  form,
  onStringFieldChange,
  onBooleanFieldChange,
}: SupplierCreditProps) {
  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between rounded-lg border border-default-200 p-4">
        <span className="text-sm">Active supplier (internal)</span>
        <Switch
          isSelected={form.isActive}
          onValueChange={(value) => onBooleanFieldChange("isActive", value)}
        />
      </div>

      {!form.isActive && (
        <div className="rounded-lg border border-info-200 bg-info-50 p-3">
          <div className="flex items-start gap-2">
            <BsInfoCircle className="mt-0.5 text-lg text-info-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-info-900">
                ℹ️ Inactive by default
              </p>
              <p className="mt-1 text-xs text-info-800">
                New suppliers start inactive until legal status is approved.
              </p>
            </div>
          </div>
        </div>
      )}

      <Divider className="my-4" />

      <div className="flex items-center justify-between rounded-lg border border-default-200 p-4">
        <div className="flex items-center gap-2">
          <BsCreditCardFill className="text-xl text-default-500" />
          <span className="text-sm">Has approved credit?</span>
        </div>
        <Switch
          isSelected={form.hasCredit}
          onValueChange={(value) => onBooleanFieldChange("hasCredit", value)}
        />
      </div>

      {form.hasCredit && (
        <div className="space-y-4">
          <Input
            label="Promissory note #"
            value={form.promissoryNoteNumber}
            onValueChange={(value) =>
              onStringFieldChange("promissoryNoteNumber", value)
            }
          />

          <Input
            label="Promissory note signing date"
            type="date"
            value={form.promissoryNoteDate}
            onValueChange={(value) =>
              onStringFieldChange("promissoryNoteDate", value)
            }
          />
        </div>
      )}
    </div>
  );
}
