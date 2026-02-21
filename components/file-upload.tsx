"use client";

import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { useState, useRef, useEffect } from "react";
import { BsCheckCircleFill, BsFileEarmarkPdf, BsTrash, BsUpload } from "react-icons/bs";
import toast from "react-hot-toast";

// Función auxiliar para subir archivos
// En desarrollo: guarda localmente
// En producción: usa Cloudinary con carpeta por cliente
export async function uploadFileToCldinary(
  file: File,
  uploadFolder: string,
  publicId?: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", publicId || file.name);
  formData.append("uploadFolder", uploadFolder); // Pasar la carpeta personalizada

  const uploadRes = await fetch("/api/documents/upload", {
    method: "POST",
    body: formData,
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    console.error("Error al guardar documento:", {
      status: uploadRes.status,
      statusText: uploadRes.statusText,
      errorText,
    });
    throw new Error(`Error al guardar archivo: ${uploadRes.status} ${uploadRes.statusText}`);
  }

  const json = (await uploadRes.json()) as { url?: string };

  if (!json.url) {
    throw new Error("No se obtuvo la URL del documento");
  }

  return json.url;
}

type FileUploadProps = {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  onClear: () => void;
  onFileSelect?: (file: File) => void; // Para manejar archivo antes de subir
  isRequired?: boolean;
  errorMessage?: string;
  uploadFolder: string;
  acceptedFileTypes?: string;
  maxSizeMB?: number;
  autoUpload?: boolean; // Si false, solo selecciona sin subir
};

export function FileUpload({
  label,
  value,
  onChange,
  onClear,
  onFileSelect,
  isRequired = false,
  errorMessage,
  uploadFolder,
  acceptedFileTypes = ".pdf",
  maxSizeMB = 10,
  autoUpload = true,
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar el estado visual cuando value cambia (por cambio de tab o re-render)
  useEffect(() => {
    if (value && selectedFileName === "") {
      // Si hay un value pero no hay selectedFileName, establecer un nombre para indicar que está cargado
      setSelectedFileName("archivo-cargado");
    }
  }, [value]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error(`El archivo debe ser menor a ${maxSizeMB}MB`);
      return;
    }

    // Validar tipo
    const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!acceptedFileTypes.includes(fileExtension)) {
      toast.error(`Solo se permiten archivos: ${acceptedFileTypes}`);
      return;
    }

    setSelectedFileName(file.name);
    
    // Si no es auto-upload, solo guardar el nombre y archivo
    if (!autoUpload) {
      if (onFileSelect) {
        onFileSelect(file);
      }
      return;
    }

    // Si es auto-upload, subir inmediatamente
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const url = await uploadFileToCldinary(file, uploadFolder);
      onChange(url);
      toast.success("Archivo subido correctamente");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error(
        error instanceof Error ? error.message : "Error al subir archivo",
      );
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleClear = () => {
    onClear();
    setSelectedFileName("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          {label}
          {isRequired && <span className="ml-1 text-danger">*</span>}
        </label>
      </div>

      {value ? (
        <div className="flex items-center gap-2 rounded-medium border-2 border-default-200 bg-default-50 p-3">
          <BsCheckCircleFill className="text-xl text-success" />
          <div className="flex-1">
            <a
              className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer"
              href={value}
              rel="noopener noreferrer"
              target="_blank"
              download
              onClick={(e) => {
                // Asegurar que se abre en nueva pestaña
                window.open(value, "_blank");
                e.preventDefault();
              }}
            >
              <BsFileEarmarkPdf className="text-lg" />
              Ver documento
            </a>
          </div>
          <Button
            color="danger"
            isIconOnly
            size="sm"
            variant="flat"
            onPress={handleClear}
          >
            <BsTrash />
          </Button>
        </div>
      ) : selectedFileName && !autoUpload ? (
        <div className="flex items-center gap-2 rounded-medium border-2 border-warning-200 bg-warning-50 p-3">
          <BsFileEarmarkPdf className="text-xl text-warning" />
          <div className="flex-1">
            <p className="text-sm text-foreground font-medium">
              {selectedFileName}
            </p>
            <p className="text-xs text-warning">Se subirá al guardar</p>
          </div>
          <Button
            color="warning"
            isIconOnly
            size="sm"
            variant="flat"
            onPress={handleClear}
          >
            <BsTrash />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            accept={acceptedFileTypes}
            className="hidden"
            disabled={isUploading}
            type="file"
            onChange={handleFileSelect}
          />
          <Button
            className="justify-start"
            color={errorMessage ? "danger" : "default"}
            isDisabled={isUploading}
            startContent={
              isUploading ? <Spinner size="sm" /> : <BsUpload className="text-lg" />
            }
            variant="flat"
            onPress={() => inputRef.current?.click()}
          >
            {isUploading ? "Subiendo..." : "Seleccionar archivo"}
          </Button>
          <p className="text-xs text-default-500">
            Formatos: {acceptedFileTypes} • Máximo: {maxSizeMB}MB
          </p>
        </div>
      )}

      {errorMessage && (
        <p className="text-xs text-danger">{errorMessage}</p>
      )}
    </div>
  );
}
