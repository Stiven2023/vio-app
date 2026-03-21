import type {
  FormErrors,
  FormState,
  SetFormState,
} from "../client-modal.types";

import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { BsEnvelopeFill, BsPersonFill } from "react-icons/bs";

import { TAX_REGIMES } from "../client-modal.constants";

type Props = {
  form: FormState;
  errors: FormErrors;
  setForm: SetFormState;
};

export function ContactTab({ form, errors, setForm }: Props) {
  return (
    <div className="space-y-4 py-4">
      <Select
        isRequired
        errorMessage={errors.taxRegime}
        isInvalid={Boolean(errors.taxRegime)}
        label="Tax regime (VAT)"
        selectedKeys={[form.taxRegime]}
        onChange={(e) => setForm((s) => ({ ...s, taxRegime: e.target.value }))}
      >
        {TAX_REGIMES.map((item) => (
          <SelectItem key={item.value}>{item.label}</SelectItem>
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
        onValueChange={(v) => setForm((s) => ({ ...s, contactName: v }))}
      />

      <Input
        isRequired
        autoComplete="email"
        description="Critical field for invoicing"
        endContent={<span className="text-danger">*</span>}
        errorMessage={errors.email}
        inputMode="email"
        isInvalid={Boolean(errors.email)}
        label="Email address"
        startContent={<BsEnvelopeFill className="text-xl text-default-500" />}
        type="text"
        value={form.email}
        onValueChange={(v) => setForm((s) => ({ ...s, email: v }))}
      />
    </div>
  );
}
