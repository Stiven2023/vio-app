import { Input } from "@heroui/input";
import { BsGeoAltFill } from "react-icons/bs";

import type { FormErrors, FormState, SetFormState } from "../client-modal.types";

type Props = {
  form: FormState;
  errors: FormErrors;
  setForm: SetFormState;
};

export function LocationTab({ form, errors, setForm }: Props) {
  const departmentLabel =
    form.clientType === "EXTRANJERO" ? "Región / Provincia" : "Departamento";

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
        onValueChange={(v) => setForm((s) => ({ ...s, address: v }))}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Código postal"
          value={form.postalCode}
          onValueChange={(v) => setForm((s) => ({ ...s, postalCode: v }))}
        />

        <Input
          label="País"
          value={form.country}
          onValueChange={(v) => setForm((s) => ({ ...s, country: v }))}
        />

        <Input
          label={departmentLabel}
          value={form.department}
          onValueChange={(v) => setForm((s) => ({ ...s, department: v }))}
        />

        <Input
          label="Ciudad"
          value={form.city}
          onValueChange={(v) => setForm((s) => ({ ...s, city: v }))}
        />
      </div>
    </div>
  );
}
