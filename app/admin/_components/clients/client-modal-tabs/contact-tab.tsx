import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { BsEnvelopeFill, BsPersonFill } from "react-icons/bs";

import { TAX_REGIMES } from "../client-modal.constants";
import type { FormErrors, FormState, SetFormState } from "../client-modal.types";

type Props = {
  form: FormState;
  errors: FormErrors;
  setForm: SetFormState;
};

export function ContactTab({ form, errors, setForm }: Props) {
  return (
    <div className="space-y-4 py-4">
      <Select
        errorMessage={errors.taxRegime}
        isInvalid={Boolean(errors.taxRegime)}
        isRequired
        label="Régimen fiscal (IVA)"
        selectedKeys={[form.taxRegime]}
        onChange={(e) => setForm((s) => ({ ...s, taxRegime: e.target.value }))}
      >
        {TAX_REGIMES.map((item) => (
          <SelectItem key={item.value}>{item.label}</SelectItem>
        ))}
      </Select>

      <Input
        description="Persona de contacto en la empresa"
        endContent={<span className="text-danger">*</span>}
        errorMessage={errors.contactName}
        isInvalid={Boolean(errors.contactName)}
        isRequired
        label="Nombre de contacto"
        startContent={<BsPersonFill className="text-xl text-default-500" />}
        value={form.contactName}
        onValueChange={(v) => setForm((s) => ({ ...s, contactName: v }))}
      />

      <Input
        description="Campo crítico para facturación"
        endContent={<span className="text-danger">*</span>}
        errorMessage={errors.email}
        isInvalid={Boolean(errors.email)}
        isRequired
        label="Correo electrónico"
        startContent={<BsEnvelopeFill className="text-xl text-default-500" />}
        type="text"
        inputMode="email"
        autoComplete="email"
        value={form.email}
        onValueChange={(v) => setForm((s) => ({ ...s, email: v }))}
      />
    </div>
  );
}
