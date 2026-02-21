"use client";

import { FileUpload } from "@/components/file-upload";
import {
  type DocumentFieldKey,
  getRequiredDocumentsByIdentificationType,
} from "@/src/utils/identification-document-rules";

type Props = {
  identificationType: string;
  errors?: Record<string, string>;
  values: Partial<Record<DocumentFieldKey, string>>;
  uploadFolder: string;
  autoUpload?: boolean;
  disabled?: boolean;
  onFileSelect?: (fieldName: DocumentFieldKey, file: File) => void;
  onChange: (field: DocumentFieldKey, url: string) => void;
  onClear: (field: DocumentFieldKey) => void;
};

export function IdentificationDocumentsSection({
  identificationType,
  errors,
  values,
  uploadFolder,
  autoUpload = true,
  disabled = false,
  onFileSelect,
  onChange,
  onClear,
}: Props) {
  const requiredDocuments =
    getRequiredDocumentsByIdentificationType(identificationType);

  if (disabled && !identificationType) {
    return (
      <div className="rounded-lg border border-warning bg-warning/10 p-4">
        <p className="text-sm text-warning">
          Selecciona un tipo de identificación para cargar documentos.
        </p>
      </div>
    );
  }

  if (!requiredDocuments.length) return null;

  return (
    <div className="space-y-4 pt-3">
      {requiredDocuments.map((doc) => (
        <FileUpload
          key={doc.field}
          acceptedFileTypes=".pdf"
          autoUpload={autoUpload}
          errorMessage={errors?.[doc.field]}
          isRequired
          label={doc.label}
          maxSizeMB={10}
          uploadFolder={uploadFolder}
          value={values[doc.field] ?? ""}
          onChange={(url) => onChange(doc.field, url)}
          onClear={() => onClear(doc.field)}
          onFileSelect={
            onFileSelect ? (file) => onFileSelect(doc.field, file) : undefined
          }
        />
      ))}
    </div>
  );
}
