import type {
  FormErrors,
  FormState,
  SetFormState,
} from "../client-modal.types";

import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { BsPersonFill } from "react-icons/bs";

import { CLIENT_TYPES, IDENTIFICATION_TYPES } from "../client-modal.constants";

import { IdentificationDocumentsSection } from "@/components/identification-documents-section";

type Props = {
  form: FormState;
  errors: FormErrors;
  setForm: SetFormState;
  isEditing: boolean;
  onIdentificationBlur?: () => void;
  onFileSelect?: (fieldName: string, file: File) => void;
};

export function IdentificationTab({
  form,
  errors,
  setForm,
  isEditing,
  onIdentificationBlur,
  onFileSelect,
}: Props) {
  const identificationHint =
    form.identificationType === "CC"
      ? "National ID: numbers only, 6 to 10 digits"
      : form.identificationType === "NIT"
        ? "NIT: numbers only, 8 to 12 digits"
        : form.identificationType === "CE"
          ? "Foreign ID: alphanumeric, 5 to 15 characters"
          : form.identificationType === "PAS"
            ? "Passport: alphanumeric, 5 to 20 characters"
            : "Foreign company: minimum 3 characters";

  const identificationInputMode =
    form.identificationType === "CC" || form.identificationType === "NIT"
      ? "numeric"
      : "text";

  const showDocuments = Boolean(form.identificationType);

  return (
    <div className="space-y-4 py-4">
      <Select
        isRequired
        description="Defines the code: CN (National), CE (Foreign), EM (Employee)"
        endContent={<span className="text-danger">*</span>}
        errorMessage={errors.clientType}
        isDisabled={isEditing}
        isInvalid={Boolean(errors.clientType)}
        label="Client type"
        selectedKeys={[form.clientType]}
        onChange={(e) => setForm((s) => ({ ...s, clientType: e.target.value }))}
      >
        {CLIENT_TYPES.map((item) => (
          <SelectItem key={item.value}>{item.label}</SelectItem>
        ))}
      </Select>

      <Input
        isRequired
        description="Critical required field"
        endContent={<span className="text-danger">*</span>}
        errorMessage={errors.name}
        isInvalid={Boolean(errors.name)}
        label="Third party name"
        startContent={<BsPersonFill className="text-xl text-default-500" />}
        value={form.name}
        onValueChange={(v) => setForm((s) => ({ ...s, name: v }))}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select
          isRequired
          errorMessage={errors.identificationType}
          isInvalid={Boolean(errors.identificationType)}
          label="ID type"
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
          isRequired
          description={identificationHint}
          errorMessage={errors.identification}
          inputMode={identificationInputMode}
          isInvalid={Boolean(errors.identification)}
          label="Identification"
          value={form.identification}
          onBlur={onIdentificationBlur}
          onValueChange={(v) => setForm((s) => ({ ...s, identification: v }))}
        />

        <Input
          label="Verification digit"
          maxLength={1}
          value={form.dv}
          onValueChange={(v) => setForm((s) => ({ ...s, dv: v }))}
        />

        <Input
          label="Branch"
          value={form.branch}
          onValueChange={(v) => setForm((s) => ({ ...s, branch: v }))}
        />
      </div>

      {showDocuments && (
        <div className="space-y-4 border-t border-default-200 pt-4">
          <h3 className="text-sm font-semibold text-foreground">
            Required documents
          </h3>
          <IdentificationDocumentsSection
            autoUpload={false}
            errors={errors}
            identificationType={form.identificationType}
            uploadFolder="clients/documents"
            values={form}
            onChange={(field, url) => setForm((s) => ({ ...s, [field]: url }))}
            onClear={(field) => setForm((s) => ({ ...s, [field]: "" }))}
            onFileSelect={(field, file) => onFileSelect?.(field, file)}
          />
        </div>
      )}
    </div>
  );
}
