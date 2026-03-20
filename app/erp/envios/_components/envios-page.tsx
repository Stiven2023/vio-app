"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Button } from "@heroui/button";
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
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Chip } from "@heroui/chip";

import { usePaginatedApi } from "@/app/erp/catalog/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";
import { Pager } from "@/app/erp/catalog/_components/ui/pager";

type Shipment = {
  id: string;
  mode: "INTERNAL" | "CLIENT";
  fromArea: string;
  toArea: string;
  recipientId: string | null;
  recipientName: string | null;
  sentBy: string;
  orderCode: string;
  designName: string;
  size: string;
  routePath: string;
  isReceived: boolean;
  receivedBy: string | null;
  paymentStatus: "PAGADO" | "PENDIENTE" | "NA" | null;
  customerDocumentType: "F" | "R" | null;
  documentRef: "RECIBO_CAJA" | "PREFACTURA" | null;
  emailMode: "REGISTRADO" | "NUEVO" | "AMBOS" | null;
  emailTo: string | null;
  createdAt: string | null;
};

const AREA_OPTIONS = [
  { key: "VIOMAR", label: "Viomar" },
  { key: "CONFECCIONISTA", label: "Confeccionista" },
  { key: "EMPAQUE", label: "Empaque" },
  { key: "CLIENTE", label: "Cliente" },
];

export function EnviosPage() {
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientOptions, setRecipientOptions] = useState<
    Array<{ id: string; code: string | null; name: string; contactName: string | null }>
  >([]);

  const [form, setForm] = useState({
    mode: "INTERNAL",
    fromArea: "VIOMAR",
    toArea: "CONFECCIONISTA",
    recipientId: "",
    recipientName: "",
    sentBy: "",
    orderCode: "",
    designName: "",
    size: "",
    routePath: "",
    paymentStatus: "PENDIENTE",
    customerDocumentType: "F",
    emailMode: "REGISTRADO",
    emailTo: "",
  });

  const endpoint = useMemo(() => {
    const query = q.trim();
    return query ? `/api/shipments?q=${encodeURIComponent(query)}` : "/api/shipments";
  }, [q]);

  const { data, loading, page, setPage, refresh } = usePaginatedApi<Shipment>(
    endpoint,
    10,
  );

  const loadRecipients = async (query: string, area: string) => {
    if (area !== "CONFECCIONISTA") {
      setRecipientOptions([]);
      return;
    }

    try {
      const res = await apiJson<{
        items: Array<{ id: string; code: string | null; name: string; contactName: string | null }>;
      }>(
        `/api/shipments/recipients?area=${encodeURIComponent(area)}&q=${encodeURIComponent(query.trim())}`,
      );
      setRecipientOptions(Array.isArray(res.items) ? res.items : []);
    } catch {
      setRecipientOptions([]);
    }
  };

  const createShipment = async () => {
    if (saving) return;

    if (form.toArea === "CONFECCIONISTA" && !String(form.recipientId ?? "").trim()) {
      toast.error("Selecciona un confeccionista destinatario");
      return;
    }

    try {
      setSaving(true);
      await apiJson("/api/shipments", {
        method: "POST",
        body: JSON.stringify(form),
      });
      toast.success("Shipment registered");
      setModalOpen(false);
      setForm((prev) => ({
        ...prev,
        recipientId: "",
        recipientName: "",
        sentBy: "",
        orderCode: "",
        designName: "",
        size: "",
        routePath: "",
        emailTo: "",
      }));
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const markReceived = async (shipment: Shipment) => {
    try {
      await apiJson("/api/shipments", {
        method: "PUT",
        body: JSON.stringify({
          id: shipment.id,
          markReceived: true,
          receivedBy: "Viomar Reception",
        }),
      });
      toast.success("Shipment marked as received");
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Input
          className="sm:w-80"
          label="Search"
          placeholder="Order, design, size, origin or destination"
          value={q}
          onValueChange={setQ}
        />
        <div className="flex gap-2">
          <Button color="primary" onPress={() => setModalOpen(true)}>
            New shipment
          </Button>
          <Button variant="flat" onPress={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      <Table aria-label="Shipments table">
        <TableHeader>
          <TableColumn>Type</TableColumn>
          <TableColumn>Order</TableColumn>
          <TableColumn>Design</TableColumn>
          <TableColumn>Size</TableColumn>
          <TableColumn>Sent by</TableColumn>
          <TableColumn>Recipient</TableColumn>
          <TableColumn>Route</TableColumn>
          <TableColumn>Payment/Doc</TableColumn>
          <TableColumn>Status</TableColumn>
          <TableColumn>Action</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={loading ? "" : "No shipments"}
          items={data?.items ?? []}
        >
          {(row) => (
            <TableRow key={row.id}>
              <TableCell>{row.mode === "CLIENT" ? "Client" : "Internal"}</TableCell>
              <TableCell>{row.orderCode}</TableCell>
              <TableCell>{row.designName}</TableCell>
              <TableCell>{row.size}</TableCell>
              <TableCell>{row.sentBy}</TableCell>
              <TableCell>{row.recipientName ?? "-"}</TableCell>
              <TableCell>
                {row.fromArea} → {row.toArea}
              </TableCell>
              <TableCell>
                {row.mode === "CLIENT"
                  ? `${row.paymentStatus ?? "-"} / ${row.documentRef ?? "-"}`
                  : "-"}
              </TableCell>
              <TableCell>
                {row.isReceived ? (
                  <Chip color="success" size="sm">Received</Chip>
                ) : (
                  <Chip color="warning" size="sm">Pending</Chip>
                )}
              </TableCell>
              <TableCell>
                {row.mode === "INTERNAL" && !row.isReceived ? (
                  <Button size="sm" variant="flat" onPress={() => markReceived(row)}>
                    Mark received
                  </Button>
                ) : (
                  "-"
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {data ? <Pager data={data} page={page} onChange={setPage} /> : null}

      <Modal isOpen={modalOpen} onOpenChange={setModalOpen}>
        <ModalContent>
          <ModalHeader>Register shipment</ModalHeader>
          <ModalBody>
            <Select
              label="Type"
              selectedKeys={[form.mode]}
              onSelectionChange={(keys) => {
                const key = String(Array.from(keys)[0] ?? "INTERNAL");
                setForm((prev) => ({ ...prev, mode: key === "CLIENT" ? "CLIENT" : "INTERNAL" }));
              }}
            >
              <SelectItem key="INTERNAL">Internal</SelectItem>
              <SelectItem key="CLIENT">Client</SelectItem>
            </Select>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="From"
                selectedKeys={[form.fromArea]}
                onSelectionChange={(keys) =>
                  setForm((prev) => ({ ...prev, fromArea: String(Array.from(keys)[0] ?? "") }))
                }
                items={AREA_OPTIONS}
              >
                {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
              </Select>

              <Select
                label="To"
                selectedKeys={[form.toArea]}
                onSelectionChange={(keys) => {
                  const toArea = String(Array.from(keys)[0] ?? "");
                  setForm((prev) => ({
                    ...prev,
                    toArea,
                    recipientId: "",
                    recipientName: "",
                  }));
                  setRecipientQuery("");
                  void loadRecipients("", toArea);
                }}
                items={AREA_OPTIONS}
              >
                {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
              </Select>
            </div>

            <Input label="Sent by" value={form.sentBy} onValueChange={(v) => setForm((p) => ({ ...p, sentBy: v }))} />
            {form.toArea === "CONFECCIONISTA" ? (
              <Autocomplete
                defaultItems={recipientOptions}
                inputValue={recipientQuery}
                label="Recipient (Confectionist)"
                placeholder="Search confectionist"
                selectedKey={form.recipientId || null}
                onInputChange={(value) => {
                  setRecipientQuery(value);
                  void loadRecipients(value, "CONFECCIONISTA");
                }}
                onSelectionChange={(key) => {
                  const id = String(key ?? "");
                  const selected = recipientOptions.find((item) => item.id === id);
                  setForm((prev) => ({
                    ...prev,
                    recipientId: id,
                    recipientName: selected?.name ?? prev.recipientName,
                  }));
                }}
              >
                {(item) => (
                  <AutocompleteItem
                    key={item.id}
                    textValue={`${item.code ?? ""} ${item.name} ${item.contactName ?? ""}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{item.code ?? "-"} · {item.name}</span>
                      <span className="text-xs text-default-500">{item.contactName ?? "No contact"}</span>
                    </div>
                  </AutocompleteItem>
                )}
              </Autocomplete>
            ) : (
              <Input label="Recipient" value={form.recipientName} onValueChange={(v) => setForm((p) => ({ ...p, recipientName: v, recipientId: "" }))} />
            )}
            <Input label="Order" value={form.orderCode} onValueChange={(v) => setForm((p) => ({ ...p, orderCode: v }))} />
            <Input label="Design" value={form.designName} onValueChange={(v) => setForm((p) => ({ ...p, designName: v }))} />
            <Input label="Size" value={form.size} onValueChange={(v) => setForm((p) => ({ ...p, size: v }))} />
            <Input label="Route / destination" value={form.routePath} onValueChange={(v) => setForm((p) => ({ ...p, routePath: v }))} />

            {form.mode === "CLIENT" ? (
              <>
                <Select
                  label="Client pays?"
                  selectedKeys={[form.paymentStatus]}
                  onSelectionChange={(keys) =>
                    setForm((prev) => ({ ...prev, paymentStatus: String(Array.from(keys)[0] ?? "PENDIENTE") }))
                  }
                >
                  <SelectItem key="PAGADO">Paid</SelectItem>
                  <SelectItem key="PENDIENTE">Pending</SelectItem>
                </Select>

                <Select
                  label="Client document type"
                  selectedKeys={[form.customerDocumentType]}
                  onSelectionChange={(keys) =>
                    setForm((prev) => ({ ...prev, customerDocumentType: String(Array.from(keys)[0] ?? "F") }))
                  }
                >
                  <SelectItem key="F">F (Cash receipt)</SelectItem>
                  <SelectItem key="R">R (Pre-invoice)</SelectItem>
                </Select>

                <Select
                  label="Email"
                  selectedKeys={[form.emailMode]}
                  onSelectionChange={(keys) =>
                    setForm((prev) => ({ ...prev, emailMode: String(Array.from(keys)[0] ?? "REGISTRADO") }))
                  }
                >
                  <SelectItem key="REGISTRADO">Registered</SelectItem>
                  <SelectItem key="NUEVO">New</SelectItem>
                  <SelectItem key="AMBOS">Both</SelectItem>
                </Select>

                <Input
                  label="New email (if applicable)"
                  value={form.emailTo}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, emailTo: v }))}
                />
              </>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button isDisabled={saving} variant="flat" onPress={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button color="primary" isLoading={saving} onPress={createShipment}>
              Save shipment
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
