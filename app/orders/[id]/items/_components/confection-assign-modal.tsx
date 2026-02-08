"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";

import { apiJson, getErrorMessage } from "@/app/orders/_lib/api";

type ConfectionOption = { id: string; name: string };

type Assignment = {
  id: string;
  confectionistId: string | null;
  confectionistName: string | null;
  assignedAt: string | null;
  finishedAt: string | null;
};

export function ConfectionAssignModal({
  orderItemId,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  orderItemId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [options, setOptions] = useState<ConfectionOption[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [selected, setSelected] = useState<string>("");

  const hasAssignment = Boolean(assignment?.confectionistId);

  const title = useMemo(() => {
    if (hasAssignment) return "Cambiar confeccionista";
    return "Asignar confeccionista";
  }, [hasAssignment]);

  useEffect(() => {
    if (!isOpen) return;
    if (!orderItemId) return;

    let active = true;

    setLoading(true);
    apiJson<{ assignment: Assignment | null; options: ConfectionOption[] }>(
      `/api/orders/items/${orderItemId}/confection`,
    )
      .then((res) => {
        if (!active) return;
        setOptions(res.options ?? []);
        setAssignment(res.assignment ?? null);
        setSelected(String(res.assignment?.confectionistId ?? ""));
      })
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, orderItemId]);

  const assign = async () => {
    if (!orderItemId) return;
    if (!selected.trim()) {
      toast.error("Selecciona un confeccionista");
      return;
    }

    try {
      setSubmitting(true);
      await apiJson(`/api/orders/items/${orderItemId}/confection`, {
        method: "POST",
        body: JSON.stringify({ confectionistId: selected.trim() }),
      });

      toast.success("Confeccionista asignado");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const clear = async () => {
    if (!orderItemId) return;

    try {
      setSubmitting(true);
      await apiJson(`/api/orders/items/${orderItemId}/confection`, {
        method: "DELETE",
      });

      toast.success("Asignación retirada");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <div className="text-sm text-default-500">
            Actual: {assignment?.confectionistName ?? "-"}
          </div>

          <Select
            isDisabled={loading || submitting}
            label="Confeccionista"
            placeholder="Selecciona…"
            selectedKeys={selected ? [selected] : []}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              setSelected(first ? String(first) : "");
            }}
          >
            {options.map((o) => (
              <SelectItem key={o.id}>{o.name}</SelectItem>
            ))}
          </Select>
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={submitting}
            variant="flat"
            onPress={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            color="danger"
            isDisabled={submitting || !hasAssignment}
            variant="flat"
            onPress={clear}
          >
            Quitar
          </Button>
          <Button
            color="primary"
            isDisabled={loading}
            isLoading={submitting}
            onPress={assign}
          >
            Guardar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
