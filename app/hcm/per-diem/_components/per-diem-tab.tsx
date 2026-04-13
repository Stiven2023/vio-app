"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";

type PerDiemItem = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  details: {
    supportInvoiceUrl: string;
    amount: string;
    expenseType: string;
    tripStartDate: string;
    tripEndDate: string;
    purchaseOrderId?: string;
    supplierInvoiceId?: string;
    notes?: string;
  } | null;
};

type PerDiemListResponse = {
  items: PerDiemItem[];
};

const expenseTypes = [
  { key: "HOTEL", label: "Hotel" },
  { key: "TRAVEL", label: "Viajes" },
  { key: "MEALS", label: "Alimentacion" },
  { key: "OTHER", label: "Otro" },
];

export function PerDiemTab() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PerDiemItem[]>([]);
  const [expenseType, setExpenseType] = useState("TRAVEL");
  const [amount, setAmount] = useState("");
  const [supportInvoiceUrl, setSupportInvoiceUrl] = useState("");
  const [supportInvoiceNumber, setSupportInvoiceNumber] = useState("");
  const [tripStartDate, setTripStartDate] = useState("");
  const [tripEndDate, setTripEndDate] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [supplierInvoiceId, setSupplierInvoiceId] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/hcm/viaticos?page=1&pageSize=20");

      if (!response.ok) throw new Error("No se pudo cargar viaticos");

      const json = (await response.json()) as PerDiemListResponse;

      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      expenseType,
      amount,
      supportInvoiceUrl,
      supportInvoiceNumber,
      tripStartDate,
      tripEndDate,
      purchaseOrderId,
      supplierInvoiceId,
      notes,
    };

    const response = await fetch("/api/hcm/viaticos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return;

    setAmount("");
    setSupportInvoiceUrl("");
    setSupportInvoiceNumber("");
    setTripStartDate("");
    setTripEndDate("");
    setPurchaseOrderId("");
    setSupplierInvoiceId("");
    setNotes("");
    await load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-2">
          <h3 className="text-base font-semibold">HCM | Viaticos</h3>
          <p className="text-sm text-default-600">
            Registra soporte, valor y asociacion documental. El viatico queda
            clasificado como abono para validacion contable.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Select
                label="Tipo de gasto"
                selectedKeys={[expenseType]}
                variant="bordered"
                onSelectionChange={(keys) => {
                  setExpenseType(String(Array.from(keys)[0] ?? "TRAVEL"));
                }}
              >
                {expenseTypes.map((item) => (
                  <SelectItem key={item.key}>{item.label}</SelectItem>
                ))}
              </Select>
              <Input
                isRequired
                label="Valor"
                type="number"
                value={amount}
                variant="bordered"
                onValueChange={setAmount}
              />
              <Input
                isRequired
                label="URL factura soporte"
                type="url"
                value={supportInvoiceUrl}
                variant="bordered"
                onValueChange={setSupportInvoiceUrl}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                label="Numero factura soporte"
                value={supportInvoiceNumber}
                variant="bordered"
                onValueChange={setSupportInvoiceNumber}
              />
              <Input
                label="Orden de compra asociada (UUID)"
                value={purchaseOrderId}
                variant="bordered"
                onValueChange={setPurchaseOrderId}
              />
              <Input
                label="Factura proveedor asociada (UUID)"
                value={supplierInvoiceId}
                variant="bordered"
                onValueChange={setSupplierInvoiceId}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  isRequired
                  label="Inicio viaje"
                  type="date"
                  value={tripStartDate}
                  variant="bordered"
                  onValueChange={setTripStartDate}
                />
                <Input
                  isRequired
                  label="Fin viaje"
                  type="date"
                  value={tripEndDate}
                  variant="bordered"
                  onValueChange={setTripEndDate}
                />
              </div>
            </div>

            <Textarea
              label="Notas"
              minRows={3}
              value={notes}
              variant="bordered"
              onValueChange={setNotes}
            />

            <Button color="primary" type="submit">
              Registrar viatico
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-2">
          <h4 className="text-sm font-semibold">Ultimos viaticos</h4>
          <div className="max-h-80 overflow-y-auto rounded-medium border border-default-200">
            <table className="w-full text-sm">
              <thead className="bg-default-100 text-left">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Valor</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-default-100">
                    <td className="px-3 py-2">
                      {new Date(item.createdAt).toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-3 py-2">
                      {item.details?.expenseType ?? "-"}
                    </td>
                    <td className="px-3 py-2">
                      {item.details?.amount ?? "0.00"}
                    </td>
                    <td className="px-3 py-2">{item.status}</td>
                  </tr>
                ))}
                {!loading && items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-2 text-default-500" colSpan={4}>
                      No hay viaticos registrados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
