import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { BsPersonFill } from "react-icons/bs";

import {
  CLIENT_TYPES,
  IDENTIFICATION_TYPES,
  PERSON_TYPES,
} from "../client-modal.constants";
import type { FormErrors, FormState, SetFormState } from "../client-modal.types";
import { FileUpload } from "@/components/file-upload";

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

  const isNational = form.clientType === "NACIONAL";
  const isForeign = form.clientType === "EXTRANJERO";
  const isNaturalPerson = form.personType === "NATURAL";
  const isLegalPerson = form.personType === "JURIDICA";
  const showPersonType = isNational || isForeign; // Mostrar tipo de persona para nacionales y extranjeros
  const showDocuments = (isNational || isForeign) && (isNaturalPerson || isLegalPerson);

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

      {showPersonType && (
        <div className="space-y-4 border-t border-default-200 pt-4">
          <Select
            description="Define si es persona natural o jurídica (empresa)"
            endContent={<span className="text-danger">*</span>}
            errorMessage={errors.personType}
            isInvalid={Boolean(errors.personType)}
            isRequired
            label="Tipo de persona"
            selectedKeys={form.personType ? [form.personType] : []}
            onChange={(e) => setForm((s) => ({ ...s, personType: e.target.value }))}
          >
            {PERSON_TYPES.map((item) => (
              <SelectItem key={item.value}>{item.label}</SelectItem>
            ))}
          </Select>
        </div>
      )}

      {showDocuments && (
        <div className="space-y-4 border-t border-default-200 pt-4">
          <h3 className="text-sm font-semibold text-foreground">
            Documentos requeridos
          </h3>
          
          {isNational && isNaturalPerson && (
            <>
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                errorMessage={errors.identityDocumentUrl}
                isRequired
                label="Cédula del titular"
                maxSizeMB={10}
                uploadFolder="clients/documents"
                value={form.identityDocumentUrl}
                onChange={(url) =>
                  setForm((s) => ({ ...s, identityDocumentUrl: url }))
                }
                onClear={() =>
                  setForm((s) => ({ ...s, identityDocumentUrl: "" }))
                }
                onFileSelect={(file) => onFileSelect?.("identityDocumentUrl", file)}
              />
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                errorMessage={errors.rutDocumentUrl}
                isRequired
                label="RUT"
                maxSizeMB={10}
                uploadFolder="clients/documents"
                value={form.rutDocumentUrl}
                onChange={(url) => setForm((s) => ({ ...s, rutDocumentUrl: url }))}
                onClear={() => setForm((s) => ({ ...s, rutDocumentUrl: "" }))}
                onFileSelect={(file) => onFileSelect?.("rutDocumentUrl", file)}
              />
            </>
          )}

          {isNational && isLegalPerson && (
            <>
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                errorMessage={errors.rutDocumentUrl}
                isRequired
                label="RUT de la empresa"
                maxSizeMB={10}
                uploadFolder="clients/documents"
                value={form.rutDocumentUrl}
                onChange={(url) => setForm((s) => ({ ...s, rutDocumentUrl: url }))}
                onClear={() => setForm((s) => ({ ...s, rutDocumentUrl: "" }))}
              />
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                errorMessage={errors.commerceChamberDocumentUrl}
                isRequired
                label="Cámara de Comercio"
                maxSizeMB={10}
                uploadFolder="clients/documents"
                value={form.commerceChamberDocumentUrl}
                onChange={(url) =>
                  setForm((s) => ({ ...s, commerceChamberDocumentUrl: url }))
                }
                onClear={() =>
                  setForm((s) => ({ ...s, commerceChamberDocumentUrl: "" }))
                }
                onFileSelect={(file) => onFileSelect?.("commerceChamberDocumentUrl", file)}
              />
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                errorMessage={errors.identityDocumentUrl}
                isRequired
                label="Cédula del representante legal"
                maxSizeMB={10}
                uploadFolder="clients/documents"
                value={form.identityDocumentUrl}
                onChange={(url) =>
                  setForm((s) => ({ ...s, identityDocumentUrl: url }))
                }
                onClear={() =>
                  setForm((s) => ({ ...s, identityDocumentUrl: "" }))
                }
              />
            </>
          )}
          
          {isForeign && isNaturalPerson && (
            <>
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                errorMessage={errors.identityDocumentUrl}
                isRequired
                label="ID Extranjero (CE/Pasaporte)"
                maxSizeMB={10}
                uploadFolder="clients/documents"
                value={form.identityDocumentUrl}
                onChange={(url) =>
                  setForm((s) => ({ ...s, identityDocumentUrl: url }))
                }
                onClear={() =>
                  setForm((s) => ({ ...s, identityDocumentUrl: "" }))
                }
              />
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                errorMessage={errors.passportDocumentUrl}
                isRequired
                label="Pasaporte / PPT"
                maxSizeMB={10}
                uploadFolder="clients/documents"
                value={form.passportDocumentUrl}
                onChange={(url) =>
                  setForm((s) => ({ ...s, passportDocumentUrl: url }))
                }
                onClear={() =>
                  setForm((s) => ({ ...s, passportDocumentUrl: "" }))
                }
                onFileSelect={(file) => onFileSelect?.("passportDocumentUrl", file)}
              />
            </>
          )}
          
          {isForeign && isLegalPerson && (
            <>
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                errorMessage={errors.taxCertificateDocumentUrl}
                isRequired
                label="Certificado Tributario"
                maxSizeMB={10}
                uploadFolder="clients/documents"
                value={form.taxCertificateDocumentUrl}
                onChange={(url) =>
                  setForm((s) => ({ ...s, taxCertificateDocumentUrl: url }))
                }
                onClear={() =>
                  setForm((s) => ({ ...s, taxCertificateDocumentUrl: "" }))
                }
                onFileSelect={(file) => onFileSelect?.("taxCertificateDocumentUrl", file)}
              />
              <FileUpload
                acceptedFileTypes=".pdf"
                autoUpload={false}
                errorMessage={errors.companyIdDocumentUrl}
                isRequired
                label="ID de la Empresa"
                maxSizeMB={10}
                uploadFolder="clients/documents"
                value={form.companyIdDocumentUrl}
                onChange={(url) =>
                  setForm((s) => ({ ...s, companyIdDocumentUrl: url }))
                }
                onClear={() =>
                  setForm((s) => ({ ...s, companyIdDocumentUrl: "" }))
                }
                onFileSelect={(file) => onFileSelect?.("companyIdDocumentUrl", file)}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
