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
  onStringFieldChange: (field: keyof SupplierSectionsFormState, value: string) => void;
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
      ? "CC: solo números, entre 6 y 10 dígitos"
      : form.identificationType === "NIT"
        ? "NIT: solo números, entre 8 y 12 dígitos"
        : form.identificationType === "CE"
          ? "CE: alfanumérico, entre 5 y 15 caracteres"
          : form.identificationType === "PAS"
            ? "Pasaporte: alfanumérico, entre 5 y 20 caracteres"
            : "Empresa exterior: mínimo 3 caracteres";

  const identificationInputMode =
    form.identificationType === "CC" || form.identificationType === "NIT"
      ? "numeric"
      : "text";

  return (
    <div className="space-y-4 py-4">
      <Input
        description="Campo crítico requerido"
        endContent={<span className="text-danger">*</span>}
        errorMessage={errors.name}
        isInvalid={Boolean(errors.name)}
        isRequired
        label="Nombre tercero"
        startContent={<BsPersonFill className="text-xl text-default-500" />}
        value={form.name}
        onValueChange={(value) => onStringFieldChange("name", value)}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select
          errorMessage={errors.identificationType}
          isInvalid={Boolean(errors.identificationType)}
          isRequired
          label="Tipo de identificación"
          selectedKeys={form.identificationType ? [form.identificationType] : []}
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
          description={identificationHint}
          errorMessage={errors.identification}
          isInvalid={Boolean(errors.identification)}
          isRequired
          inputMode={identificationInputMode}
          label="Identificación"
          value={form.identification}
          onValueChange={onIdentificationInputChange}
        />

        <Input
          label="Dígito verificación"
          maxLength={1}
          value={form.dv}
          onValueChange={(value) => onStringFieldChange("dv", value)}
        />

        <Input
          label="Sucursal"
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
        errorMessage={errors.taxRegime}
        isInvalid={Boolean(errors.taxRegime)}
        isRequired
        label="Régimen fiscal (IVA)"
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
        description="Persona de contacto en la empresa"
        endContent={<span className="text-danger">*</span>}
        errorMessage={errors.contactName}
        isInvalid={Boolean(errors.contactName)}
        isRequired
        label="Nombre de Contacto"
        startContent={<BsPersonFill className="text-xl text-default-500" />}
        value={form.contactName}
        onValueChange={(value) => onStringFieldChange("contactName", value)}
      />

      <Input
        description="Campo crítico para facturación"
        endContent={<span className="text-danger">*</span>}
        errorMessage={errors.email}
        isInvalid={Boolean(errors.email)}
        isRequired
        label="Email"
        startContent={<BsEnvelopeFill className="text-xl text-default-500" />}
        type="text"
        inputMode="email"
        autoComplete="email"
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
        endContent={<span className="text-danger">*</span>}
        errorMessage={errors.address}
        isInvalid={Boolean(errors.address)}
        isRequired
        label="Dirección"
        startContent={<BsGeoAltFill className="text-xl text-default-500" />}
        value={form.address}
        onValueChange={(value) => onStringFieldChange("address", value)}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Código postal"
          value={form.postalCode}
          onValueChange={(value) => onStringFieldChange("postalCode", value)}
        />

        <Input
          label="País"
          value={form.country}
          onValueChange={(value) => onStringFieldChange("country", value)}
        />

        <Input
          label="Departamento"
          value={form.department}
          onValueChange={(value) => onStringFieldChange("department", value)}
        />

        <Input
          label="Ciudad"
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
      <p className="text-sm text-default-600">Móvil (requerido)</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Input
          label="Código internacional"
          placeholder="57"
          value={form.intlDialCode}
          onValueChange={(value) => onStringFieldChange("intlDialCode", value)}
        />

        <div className="md:col-span-2">
          <Input
            endContent={<span className="text-danger">*</span>}
            errorMessage={errors.mobile}
            isInvalid={Boolean(errors.mobile)}
            isRequired
            label="Móvil"
            startContent={<BsTelephoneFill className="text-xl text-default-500" />}
            value={form.mobile}
            onValueChange={(value) => onStringFieldChange("mobile", value)}
          />
        </div>
      </div>

      <Divider className="my-4" />

      <p className="text-sm text-default-600">Teléfono fijo (opcional)</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Input
          label="Código local"
          placeholder="4"
          value={form.localDialCode}
          onValueChange={(value) => onStringFieldChange("localDialCode", value)}
        />

        <div className="md:col-span-2">
          <Input
            label="Fijo"
            value={form.landline}
            onValueChange={(value) => onStringFieldChange("landline", value)}
          />
        </div>

        <Input
          label="Extensión"
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
        <span className="text-sm">Proveedor activo (interno)</span>
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
                ℹ️ Proveedor inactivo por defecto
              </p>
              <p className="mt-1 text-xs text-info-800">
                Proveedores nuevos comienzan inactivos hasta aprobación de estado jurídico.
              </p>
            </div>
          </div>
        </div>
      )}

      <Divider className="my-4" />

      <div className="flex items-center justify-between rounded-lg border border-default-200 p-4">
        <div className="flex items-center gap-2">
          <BsCreditCardFill className="text-xl text-default-500" />
          <span className="text-sm">¿Tiene crédito aprobado?</span>
        </div>
        <Switch
          isSelected={form.hasCredit}
          onValueChange={(value) => onBooleanFieldChange("hasCredit", value)}
        />
      </div>

      {form.hasCredit && (
        <div className="space-y-4">
          <Input
            label="Número pagaré"
            value={form.promissoryNoteNumber}
            onValueChange={(value) =>
              onStringFieldChange("promissoryNoteNumber", value)
            }
          />

          <Input
            label="Fecha firma pagaré"
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
