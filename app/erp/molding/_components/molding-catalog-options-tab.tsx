"use client";

import type { MoldingCatalogOption } from "../_lib/types";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { FiPlus, FiTrash2 } from "react-icons/fi";

import { apiJson, getErrorMessage } from "../_lib/api";

type Props = {
  canEdit: boolean;
};

const MANAGED_FIELDS = [
  { key: "tipoAplique", label: "Tipo de aplique" },
  { key: "embroideryTechnique", label: "Técnica de bordado" },
  { key: "marquillaType", label: "Tipo de marquilla" },
  { key: "neckType", label: "Tipo de cuello" },
  { key: "sesgoType", label: "Tipo de sesgo" },
  { key: "sleeveType", label: "Tipo de manga" },
  { key: "cuffType", label: "Tipo de puño" },
  { key: "liningType", label: "Tipo de forro" },
  { key: "hoodType", label: "Tipo de capucha" },
  { key: "buttonType", label: "Tipo de botón" },
  { key: "buttonholeType", label: "Tipo de ojal" },
  { key: "pocketConfig", label: "Configuración de bolsillos" },
];

export function MoldingCatalogOptionsTab({ canEdit }: Props) {
  const [selectedFieldKey, setSelectedFieldKey] = useState(
    MANAGED_FIELDS[0].key,
  );
  const [isAdding, setIsAdding] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState<MoldingCatalogOption[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch options for selected field
  useEffect(() => {
    if (!selectedFieldKey) return;

    setIsLoading(true);
    apiJson<{ options: MoldingCatalogOption[] }>(
      `/api/molding/catalog-options?fieldKey=${encodeURIComponent(selectedFieldKey)}&activeOnly=false`,
    )
      .then((res) => setData(res.options))
      .catch(() => setData([]))
      .finally(() => setIsLoading(false));
  }, [selectedFieldKey]);

  const options = useMemo(() => data ?? [], [data]);

  async function mutate() {
    if (!selectedFieldKey) return;

    setIsLoading(true);
    try {
      const res = await apiJson<{ options: MoldingCatalogOption[] }>(
        `/api/molding/catalog-options?fieldKey=${encodeURIComponent(selectedFieldKey)}&activeOnly=false`,
      );

      setData(res.options);
    } catch {
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }
  // ─── Add new option ───────────────────────────────────────────────────────

  async function handleAdd() {
    const v = addValue.trim().toUpperCase();

    if (!v) {
      toast.error("El valor no puede estar vacío");

      return;
    }

    setSaving(true);
    try {
      await apiJson("/api/molding/catalog-options", {
        method: "POST",
        body: JSON.stringify({
          fieldKey: selectedFieldKey,
          value: v,
          label: addLabel.trim() || undefined,
          sortOrder: options.length,
        }),
      });
      toast.success(`Opción "${v}" agregada`);
      setAddValue("");
      setAddLabel("");
      setIsAdding(false);
      await mutate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete option ────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro?")) return;

    try {
      await apiJson(`/api/molding/catalog-options/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      });
      toast.success("Opción desactivada");
      await mutate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  // ─── Toggle active ────────────────────────────────────────────────────────

  async function handleToggle(id: string, current: boolean) {
    try {
      await apiJson(`/api/molding/catalog-options/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !current }),
      });
      toast.success(`Opción ${!current ? "activada" : "desactivada"}`);
      await mutate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const sortedOptions = [...options].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.value.localeCompare(b.value),
  );

  return (
    <div className="space-y-5">
      {/* Field selector */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[260px]">
          <Select
            label="Campo a administrar"
            selectedKeys={[selectedFieldKey]}
            size="sm"
            onSelectionChange={(keys) => {
              const val = Array.from(keys)[0] as string;

              if (val) {
                setSelectedFieldKey(val);
                setIsAdding(false);
              }
            }}
          >
            {MANAGED_FIELDS.map((f) => (
              <SelectItem key={f.key}>{f.label}</SelectItem>
            ))}
          </Select>
        </div>

        {canEdit && (
          <Button
            color="primary"
            size="sm"
            startContent={<FiPlus />}
            variant="flat"
            onPress={() => setIsAdding((v) => !v)}
          >
            Agregar opción
          </Button>
        )}
      </div>

      {/* Add form */}
      {isAdding && canEdit && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-default-200 bg-default-50 p-4">
          <Input
            className="min-w-[200px]"
            label="Valor (mayúsculas)"
            placeholder="Ej. BOLSILLO CARGO"
            size="sm"
            value={addValue}
            onValueChange={(v) => setAddValue(v.toUpperCase())}
          />
          <Input
            className="min-w-[200px]"
            label="Etiqueta (opcional)"
            placeholder="Ej. Bolsillo cargo lateral"
            size="sm"
            value={addLabel}
            onValueChange={setAddLabel}
          />
          <Button
            color="primary"
            isDisabled={!addValue.trim()}
            isLoading={saving}
            size="sm"
            onPress={handleAdd}
          >
            Guardar
          </Button>
          <Button
            size="sm"
            variant="flat"
            onPress={() => {
              setIsAdding(false);
              setAddValue("");
              setAddLabel("");
            }}
          >
            Cancelar
          </Button>
        </div>
      )}

      {/* Options table */}
      <Table
        removeWrapper
        aria-label="Opciones del catálogo"
        classNames={{ th: "bg-default-100" }}
      >
        <TableHeader>
          <TableColumn>Valor</TableColumn>
          <TableColumn>Etiqueta</TableColumn>
          <TableColumn>Orden</TableColumn>
          <TableColumn>Estado</TableColumn>
          {canEdit ? (
            <TableColumn>Acciones</TableColumn>
          ) : (
            <TableColumn> </TableColumn>
          )}
        </TableHeader>
        <TableBody
          emptyContent={
            isLoading ? "Cargando..." : "No hay opciones para este campo"
          }
          items={sortedOptions}
        >
          {(opt) => (
            <TableRow key={opt.id}>
              <TableCell className="font-mono text-sm">{opt.value}</TableCell>
              <TableCell className="text-sm text-default-600">
                {opt.label ?? (
                  <span className="italic text-default-400">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm">{opt.sortOrder}</TableCell>
              <TableCell>
                <Chip
                  color={opt.isActive ? "success" : "default"}
                  size="sm"
                  variant="flat"
                >
                  {opt.isActive ? "Activa" : "Inactiva"}
                </Chip>
              </TableCell>
              <TableCell>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      onPress={() => handleToggle(opt.id, opt.isActive)}
                    >
                      {opt.isActive ? "Desact." : "Act."}
                    </Button>
                    <Button
                      isIconOnly
                      color="danger"
                      size="sm"
                      variant="light"
                      onPress={() => handleDelete(opt.id)}
                    >
                      <FiTrash2 />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
