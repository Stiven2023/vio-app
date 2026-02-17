import { Input } from "@heroui/input";
import { Divider } from "@heroui/divider";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { BsCreditCardFill } from "react-icons/bs";

import { CLIENT_STATUSES } from "../client-modal.constants";
import type { FormState, SetFormState } from "../client-modal.types";

type Props = {
  form: FormState;
  setForm: SetFormState;
};

export function StatusCreditTab({ form, setForm }: Props) {
  return (
    <div className="space-y-4 py-4">
      <Select
        label="Estado del cliente"
        selectedKeys={[form.status]}
        onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
      >
        {CLIENT_STATUSES.map((item) => (
          <SelectItem key={item.value}>{item.label}</SelectItem>
        ))}
      </Select>

      <div className="flex items-center justify-between rounded-lg border border-default-200 p-4">
        <span className="text-sm">Cliente activo (interno)</span>
        <Switch
          isSelected={form.isActive}
          onValueChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
        />
      </div>

      <Divider className="my-4" />

      <div className="flex items-center justify-between rounded-lg border border-default-200 p-4">
        <div className="flex items-center gap-2">
          <BsCreditCardFill className="text-xl text-default-500" />
          <span className="text-sm">¿Tiene crédito aprobado?</span>
        </div>
        <Switch
          isSelected={form.hasCredit}
          onValueChange={(v) => setForm((s) => ({ ...s, hasCredit: v }))}
        />
      </div>

      {form.hasCredit && (
        <div className="space-y-4">
          <Input
            label="Número de pagaré"
            value={form.promissoryNoteNumber}
            onValueChange={(v) =>
              setForm((s) => ({ ...s, promissoryNoteNumber: v }))
            }
          />

          <Input
            label="Fecha firma pagaré"
            type="date"
            value={form.promissoryNoteDate}
            onValueChange={(v) =>
              setForm((s) => ({ ...s, promissoryNoteDate: v }))
            }
          />
        </div>
      )}
    </div>
  );
}
