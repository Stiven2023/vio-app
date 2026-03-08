import { Input } from "@heroui/input";
import { Divider } from "@heroui/divider";
import { BsTelephoneFill } from "react-icons/bs";

import type { FormErrors, FormState, SetFormState } from "../client-modal.types";

type Props = {
  form: FormState;
  errors: FormErrors;
  setForm: SetFormState;
};

export function PhonesTab({ form, errors, setForm }: Props) {
  return (
    <div className="space-y-4 py-4">
      <p className="text-sm text-default-600">Móvil (requerido)</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Input
          label="Código internacional"
          placeholder="57"
          value={form.intlDialCode}
          onValueChange={(v) => setForm((s) => ({ ...s, intlDialCode: v }))}
        />

        <div className="md:col-span-2">
          <Input
            description="Campo crítico para comunicación"
            endContent={<span className="text-danger">*</span>}
            errorMessage={errors.mobile}
            isInvalid={Boolean(errors.mobile)}
            isRequired
            label="Móvil"
            startContent={<BsTelephoneFill className="text-xl text-default-500" />}
            value={form.mobile}
            onValueChange={(v) => setForm((s) => ({ ...s, mobile: v }))}
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
          onValueChange={(v) => setForm((s) => ({ ...s, localDialCode: v }))}
        />

        <div className="md:col-span-2">
          <Input
            label="Fijo"
            value={form.landline}
            onValueChange={(v) => setForm((s) => ({ ...s, landline: v }))}
          />
        </div>

        <Input
          label="Extensión"
          value={form.extension}
          onValueChange={(v) => setForm((s) => ({ ...s, extension: v }))}
        />
      </div>
    </div>
  );
}
