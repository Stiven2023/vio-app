import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { BsPersonFill } from "react-icons/bs";

import {
  CLIENT_TYPES,
  IDENTIFICATION_TYPES,
} from "../client-modal.constants";
import type { FormErrors, FormState, SetFormState } from "../client-modal.types";

type Props = {
  form: FormState;
  errors: FormErrors;
  setForm: SetFormState;
  isEditing: boolean;
  onIdentificationBlur?: () => void;
};

export function IdentificationTab({
  form,
  errors,
  setForm,
  isEditing,
  onIdentificationBlur,
}: Props) {
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
      <Select
        description="Define el código: CN (Nacional), CE (Extranjero), EM (Empleado)"
        endContent={<span className="text-danger">*</span>}
        errorMessage={errors.clientType}
        isDisabled={isEditing}
        isInvalid={Boolean(errors.clientType)}
        isRequired
        label="Tipo de cliente"
        selectedKeys={[form.clientType]}
        onChange={(e) => setForm((s) => ({ ...s, clientType: e.target.value }))}
      >
        {CLIENT_TYPES.map((item) => (
          <SelectItem key={item.value}>{item.label}</SelectItem>
        ))}
      </Select>

      <Input
        description="Campo crítico requerido"
        endContent={<span className="text-danger">*</span>}
        errorMessage={errors.name}
        isInvalid={Boolean(errors.name)}
        isRequired
        label="Nombre tercero"
        startContent={<BsPersonFill className="text-xl text-default-500" />}
        value={form.name}
        onValueChange={(v) => setForm((s) => ({ ...s, name: v }))}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select
          errorMessage={errors.identificationType}
          isInvalid={Boolean(errors.identificationType)}
          isRequired
          label="Tipo de identificación"
          selectedKeys={[form.identificationType]}
          onChange={(e) =>
            setForm((s) => ({
              ...s,
              identificationType: e.target.value,
            }))
          }
        >
          {IDENTIFICATION_TYPES.map((item) => (
            <SelectItem key={item.value}>{item.label}</SelectItem>
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
          onBlur={onIdentificationBlur}
          onValueChange={(v) => setForm((s) => ({ ...s, identification: v }))}
        />

        <Input
          label="Dígito verificación"
          maxLength={1}
          value={form.dv}
          onValueChange={(v) => setForm((s) => ({ ...s, dv: v }))}
        />

        <Input
          label="Sucursal"
          value={form.branch}
          onValueChange={(v) => setForm((s) => ({ ...s, branch: v }))}
        />
      </div>
    </div>
  );
}
