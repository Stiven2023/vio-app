"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import { NumberInput } from "@heroui/react";
import { Select, SelectItem } from "@heroui/select";
import { Skeleton } from "@heroui/skeleton";
import { BsPlusCircle, BsTrash } from "react-icons/bs";

import { apiJson, getErrorMessage } from "@/app/orders/_lib/api";

type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "CREDITO";

type OrderOption = {
  id: string;
  orderCode: string;
  clientId?: string | null;
  clientName: string | null;
  clientCode?: string | null;
};

type AllocationRow = {
  id: string;
  orderId: string;
  clientId: string;
  amount: string;
  orderSearch: string;
};

const methodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "CREDITO", label: "Crédito" },
];

const transferBankOptions = ["GC 24-25", "O 29-52", "VIO-EXT."] as const;

function toAmountString(v: number | string | null | undefined) {
  const raw = String(v ?? "").trim().replace(/,/g, ".");
  if (!raw) return "";
  const n = Number(raw);
  return Number.isFinite(n) ? String(n) : "";
}

function toNumberInputValue(v: string) {
  const n = Number(String(v ?? "").replace(/,/g, "."));
  return Number.isFinite(n) ? n : 0;
}

function getPastedImageFile(e: React.ClipboardEvent<HTMLElement>) {
  const items = e.clipboardData?.items;
  if (!items) return null;

  for (const item of Array.from(items)) {
    if (String(item.type ?? "").startsWith("image/")) {
      return item.getAsFile();
    }
  }

  return null;
}

function focusById(id: string) {
  const element = document.getElementById(id) as HTMLInputElement | null;
  element?.focus();
}

export function DistributedPaymentsPage({
  preselectedOrderId,
  preselectedOrderLabel,
  fixedClientId,
  fixedClientName,
}: {
  preselectedOrderId?: string;
  preselectedOrderLabel?: string;
  fixedClientId?: string;
  fixedClientName?: string;
}) {
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderOptions, setOrderOptions] = useState<OrderOption[]>([]);

  const [depositAmount, setDepositAmount] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("TRANSFERENCIA");
  const [transferBank, setTransferBank] = useState("");
  const [transferCurrency, setTransferCurrency] = useState<"COP" | "USD">("COP");

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);

  const [allocations, setAllocations] = useState<AllocationRow[]>([
    { id: crypto.randomUUID(), orderId: "", clientId: "", amount: "", orderSearch: "" },
  ]);

  const depositAmountRef = useRef<HTMLInputElement | null>(null);
  const referenceCodeRef = useRef<HTMLInputElement | null>(null);
  const allocationOrderRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    depositAmount?: string;
    transferBank?: string;
    transferCurrency?: string;
    allocations: Record<string, { orderId?: string; amount?: string }>;
  }>({ allocations: {} });

  useEffect(() => {
    let active = true;

    setLoadingOrders(true);
    const query = orderSearch.trim();
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("limit", "20");
    if (fixedClientId) params.set("clientId", fixedClientId);

    apiJson<{ items: OrderOption[] }>(`/api/pagos/orders?${params.toString()}`)
      .then((res) => {
        if (!active) return;
        setOrderOptions(Array.isArray(res.items) ? res.items : []);
      })
      .catch(() => {
        if (!active) return;
        setOrderOptions([]);
      })
      .finally(() => {
        if (active) setLoadingOrders(false);
      });

    return () => {
      active = false;
    };
  }, [fixedClientId, orderSearch]);

  useEffect(() => {
    const selectedId = String(preselectedOrderId ?? "").trim();
    if (!selectedId) return;

    let firstRowId: string | null = null;

    setAllocations((rows) => {
      const baseRows =
        rows.length > 0
          ? rows
          : [{ id: crypto.randomUUID(), orderId: "", clientId: "", amount: "", orderSearch: "" }];

      const [first, ...rest] = baseRows;
      if (!first) return baseRows;

      firstRowId = first.id;

      if (first.orderId === selectedId) return baseRows;

      const option = orderOptions.find((item) => item.id === selectedId);
      const nextSearch = option?.orderCode ?? preselectedOrderLabel ?? first.orderSearch;

      return [
        {
          ...first,
          orderId: selectedId,
          clientId: option?.clientId ? String(option.clientId) : first.clientId,
          orderSearch: nextSearch,
        },
        ...rest,
      ];
    });

    if (firstRowId) {
      setErrors((prev) => {
        const firstId = String(firstRowId);

        return {
          ...prev,
          allocations: {
            ...prev.allocations,
            [firstId]: {
              ...(prev.allocations[firstId] ?? {}),
              orderId: undefined,
            },
          },
        };
      });
    }
  }, [preselectedOrderId, preselectedOrderLabel, orderOptions]);

  useEffect(() => {
    if (!proofFile) {
      setProofPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(proofFile);
    setProofPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [proofFile]);

  const assignedTotal = useMemo(
    () => allocations.reduce((acc, row) => acc + Math.max(0, Number(row.amount || 0)), 0),
    [allocations],
  );

  const depositTotal = useMemo(() => Math.max(0, Number(depositAmount || 0)), [depositAmount]);

  const uploadProofToCloudinary = async (file: File) => {
    const sig = await apiJson<{
      cloudName: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      params: Record<string, string>;
    }>("/api/uploads/cloudinary-signature", {
      method: "POST",
      body: JSON.stringify({ folder: "payments/distributed" }),
    });

    const formData = new FormData();

    formData.append("file", file);
    formData.append("api_key", sig.apiKey);
    formData.append("timestamp", String(sig.timestamp));
    formData.append("signature", sig.signature);
    Object.entries(sig.params ?? {}).forEach(([k, v]) => formData.append(k, v));

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => "");

      throw new Error(text || `Upload failed (${uploadRes.status})`);
    }

    const json = (await uploadRes.json()) as { secure_url?: string };

    if (!json.secure_url) throw new Error("Cloudinary no devolvió secure_url");

    return json.secure_url;
  };

  const addRow = () => {
    setAllocations((rows) => [
      ...rows,
      { id: crypto.randomUUID(), orderId: "", clientId: "", amount: "", orderSearch: "" },
    ]);
    setErrors((prev) => ({ ...prev, allocations: { ...prev.allocations } }));
  };

  const removeRow = (id: string) => {
    setAllocations((rows) => {
      const next = rows.filter((row) => row.id !== id);
      return next.length > 0
        ? next
        : [{ id: crypto.randomUUID(), orderId: "", clientId: "", amount: "", orderSearch: "" }];
    });
    setErrors((prev) => {
      const nextAllocations = { ...prev.allocations };
      delete nextAllocations[id];
      return { ...prev, allocations: nextAllocations };
    });
  };

  const submit = async () => {
    if (submitting) return;

    const nextErrors: {
      depositAmount?: string;
      transferBank?: string;
      transferCurrency?: string;
      allocations: Record<string, { orderId?: string; amount?: string }>;
    } = { allocations: {} };

    if (!depositAmount || Number(depositAmount) <= 0) {
      nextErrors.depositAmount = "La consignación total debe ser mayor a 0";
      setErrors(nextErrors);
      toast.error(nextErrors.depositAmount);
      depositAmountRef.current?.focus();
      return;
    }

    const validAllocations = allocations.filter(
      (row) => row.orderId && Number(row.amount) > 0,
    );

    allocations.forEach((row) => {
      const rowErrors: { orderId?: string; amount?: string } = {};

      if (!row.orderId) {
        rowErrors.orderId = "Selecciona un pedido";
      }

      if (!row.amount || Number(row.amount) <= 0) {
        rowErrors.amount = "Ingresa un valor mayor a 0";
      }

      if (rowErrors.orderId || rowErrors.amount) {
        nextErrors.allocations[row.id] = rowErrors;
      }
    });

    if (validAllocations.length === 0) {
      setErrors(nextErrors);
      toast.error("Agrega al menos un pedido con valor asignado");
      const firstRow = allocations[0];
      if (firstRow) {
        if (nextErrors.allocations[firstRow.id]?.orderId) {
          allocationOrderRefs.current[firstRow.id]?.focus();
        } else if (nextErrors.allocations[firstRow.id]?.amount) {
          focusById(`allocation-amount-${firstRow.id}`);
        }
      }
      return;
    }

    if (assignedTotal > depositTotal) {
      toast.error("El total asignado no puede superar la consignación total");
      return;
    }

    if (method === "TRANSFERENCIA") {
      if (!transferBank.trim()) {
        nextErrors.transferBank = "El banco es obligatorio para transferencias";
      } else if (!transferBankOptions.includes(transferBank as any)) {
        nextErrors.transferBank = "Selecciona un banco válido";
      }
      if (!transferCurrency) {
        nextErrors.transferCurrency = "La moneda es obligatoria para transferencias";
      }

      if (transferCurrency === "USD" && transferBank !== "VIO-EXT.") {
        nextErrors.transferCurrency = "USD solo se acepta con banco VIO-EXT.";
      }

      if (transferBank === "VIO-EXT." && transferCurrency !== "USD") {
        nextErrors.transferCurrency = "Con banco VIO-EXT. solo se acepta USD.";
      }

      if (nextErrors.transferBank || nextErrors.transferCurrency) {
        setErrors(nextErrors);
        toast.error(nextErrors.transferBank ?? nextErrors.transferCurrency ?? "Completa los datos de transferencia");
        return;
      }
    }

    const uniqueOrderIds = new Set(validAllocations.map((row) => row.orderId));
    if (uniqueOrderIds.size !== validAllocations.length) {
      const seen = new Set<string>();
      const duplicated = allocations.find((row) => {
        if (!row.orderId) return false;
        if (seen.has(row.orderId)) return true;
        seen.add(row.orderId);
        return false;
      });

      if (duplicated) {
        nextErrors.allocations[duplicated.id] = {
          ...(nextErrors.allocations[duplicated.id] ?? {}),
          orderId: "No repitas el mismo pedido",
        };
      }

      setErrors(nextErrors);
      toast.error("No repitas el mismo pedido en varias filas");
      if (duplicated) allocationOrderRefs.current[duplicated.id]?.focus();
      return;
    }

    const clientIds = new Set(
      validAllocations
        .map((row) => allocations.find((item) => item.id === row.id)?.clientId)
        .filter((id): id is string => Boolean(id && id.trim())),
    );

    if (clientIds.size > 1) {
      toast.error("No puedes distribuir entre pedidos de clientes diferentes");
      return;
    }

    setErrors({ allocations: {} });

    try {
      setSubmitting(true);

      const proofImageUrl = proofFile
        ? await uploadProofToCloudinary(proofFile)
        : null;

      await apiJson("/api/payments/distributed", {
        method: "POST",
        body: JSON.stringify({
          depositAmount: Number(depositAmount),
          method,
          transferBank: method === "TRANSFERENCIA" ? transferBank.trim() : null,
          transferCurrency: method === "TRANSFERENCIA" ? transferCurrency : null,
          referenceCode: referenceCode.trim() || null,
          proofImageUrl,
          allocations: validAllocations.map((row) => ({
            orderId: row.orderId,
            amount: Number(row.amount),
          })),
        }),
      });

      toast.success("Abono distribuido registrado");
      setDepositAmount("");
      setReferenceCode("");
      setMethod("TRANSFERENCIA");
      setTransferBank("");
      setTransferCurrency("COP");
      setProofFile(null);
      setAllocations([
        { id: crypto.randomUUID(), orderId: "", clientId: "", amount: "", orderSearch: "" },
      ]);
      referenceCodeRef.current?.focus();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <NumberInput
              ref={depositAmountRef}
              hideStepper
              isInvalid={Boolean(errors.depositAmount)}
              errorMessage={errors.depositAmount}
              label="Consignación total"
              value={toNumberInputValue(depositAmount)}
              formatOptions={{
                style: "currency",
                currency: "COP",
                maximumFractionDigits: 2,
              }}
              onValueChange={(v) => setDepositAmount(toAmountString(v))}
            />
            <Input
              ref={referenceCodeRef}
              label="Código de referencia"
              value={referenceCode}
              onValueChange={setReferenceCode}
            />
            <Select
              isRequired={method === "TRANSFERENCIA"}
              isInvalid={Boolean(errors.transferBank)}
              errorMessage={errors.transferBank}
              label="Banco"
              selectedKeys={transferBank ? [transferBank] : []}
              onSelectionChange={(keys) => {
                const first = String(Array.from(keys)[0] ?? "");
                setTransferBank(first);
                if (first === "VIO-EXT.") setTransferCurrency("USD");
                setErrors((prev) => ({ ...prev, transferBank: undefined, transferCurrency: undefined }));
              }}
            >
              {transferBankOptions.map((bank) => (
                <SelectItem key={bank}>{bank}</SelectItem>
              ))}
            </Select>
            <Select
              isRequired={method === "TRANSFERENCIA"}
              isInvalid={Boolean(errors.transferCurrency)}
              errorMessage={errors.transferCurrency}
              label="Moneda"
              selectedKeys={[transferCurrency]}
              onSelectionChange={(keys) => {
                const first = String(Array.from(keys)[0] ?? "COP").toUpperCase();
                setTransferCurrency(first === "USD" ? "USD" : "COP");
                setErrors((prev) => ({ ...prev, transferCurrency: undefined }));
              }}
            >
              <SelectItem key="COP" isDisabled={transferBank === "VIO-EXT."}>COP</SelectItem>
              <SelectItem key="USD" isDisabled={transferBank !== "VIO-EXT."}>USD</SelectItem>
            </Select>
            <Select
              label="Método"
              selectedKeys={[method]}
              onSelectionChange={(keys) => {
                const first = Array.from(keys)[0] as PaymentMethod | undefined;
                setMethod(first ?? "TRANSFERENCIA");
              }}
            >
              {methodOptions.map((m) => (
                <SelectItem key={m.value}>{m.label}</SelectItem>
              ))}
            </Select>
            <Input
              isReadOnly
              label="Estado"
              value="NO CONSIGNADO"
            />
          </div>

          <div>
            <div className="text-sm text-default-600 mb-1">Soporte de transferencia (opcional)</div>
            <div
              className="rounded-medium border border-dashed border-default-300 bg-default-50 p-3"
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0] ?? null;
                setProofFile(file);
              }}
              onPaste={(e) => {
                const file = getPastedImageFile(e);
                if (!file) return;
                e.preventDefault();
                setProofFile(file);
              }}
              tabIndex={0}
            >
              <p className="text-xs text-default-500 mb-2">
                Arrastra una imagen aquí, selecciónala o pégala con Ctrl+V.
              </p>
              <input
                accept="image/*"
                type="file"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {proofPreviewUrl ? (
              <div className="mt-2 overflow-hidden rounded-medium border border-default-200">
                <img
                  alt="Preview soporte transferencia"
                  className="h-40 w-full object-contain bg-default-50"
                  src={proofPreviewUrl}
                />
              </div>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Asignación por pedidos</h2>
            {fixedClientId ? (
              <div className="text-xs text-default-500">
                Cliente fijo: {fixedClientName ?? "seleccionado"}
              </div>
            ) : null}
            <Button size="sm" variant="flat" onPress={addRow}>
              <BsPlusCircle /> Agregar fila
            </Button>
          </div>

          {loadingOrders ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={`allocation-skeleton-${idx}`}
                  className="grid grid-cols-1 gap-3 rounded-medium border border-default-200 p-3 md:grid-cols-[2fr,1fr,auto]"
                >
                  <Skeleton className="h-12 w-full rounded-medium" />
                  <Skeleton className="h-12 w-full rounded-medium" />
                  <Skeleton className="h-10 w-10 rounded-medium" />
                </div>
              ))}
            </div>
          ) : null}

          {!loadingOrders
            ? allocations.map((row, index) => (
            <div key={row.id} className="grid grid-cols-1 gap-3 rounded-medium border border-default-200 p-3 md:grid-cols-[2fr,1fr,auto]">
              <Autocomplete
                defaultItems={orderOptions}
                isInvalid={Boolean(errors.allocations[row.id]?.orderId)}
                errorMessage={errors.allocations[row.id]?.orderId}
                inputValue={row.orderSearch}
                isLoading={loadingOrders}
                label={`Pedido ${index + 1}`}
                placeholder="Buscar por código pedido o cliente"
                selectedKey={row.orderId || null}
                onInputChange={(value) => {
                  setAllocations((rows) =>
                    rows.map((item) =>
                      item.id === row.id ? { ...item, orderSearch: value } : item,
                    ),
                  );
                  setErrors((prev) => ({
                    ...prev,
                    allocations: {
                      ...prev.allocations,
                      [row.id]: {
                        ...(prev.allocations[row.id] ?? {}),
                        orderId: undefined,
                      },
                    },
                  }));
                  setOrderSearch(value);
                }}
                onSelectionChange={(key) => {
                  const selectedId = String(key ?? "");
                  const selected = orderOptions.find((opt) => opt.id === selectedId);

                  if (
                    fixedClientId &&
                    selected &&
                    String(selected.clientId ?? "") !== String(fixedClientId)
                  ) {
                    toast.error("Solo puedes seleccionar pedidos del cliente actual");
                    return;
                  }

                  const existingClientId = allocations.find(
                    (item) => item.id !== row.id && item.clientId,
                  )?.clientId;

                  if (
                    !fixedClientId &&
                    selected &&
                    existingClientId &&
                    String(selected.clientId ?? "") !== String(existingClientId)
                  ) {
                    toast.error("No puedes mezclar pedidos de clientes diferentes");
                    return;
                  }

                  setAllocations((rows) =>
                    rows.map((item) =>
                      item.id === row.id
                        ? {
                            ...item,
                            orderId: selectedId,
                            clientId: String(selected?.clientId ?? ""),
                            orderSearch: selected
                              ? `${selected.orderCode} ${selected.clientName ?? ""}`.trim()
                              : item.orderSearch,
                          }
                        : item,
                    ),
                  );
                  setErrors((prev) => ({
                    ...prev,
                    allocations: {
                      ...prev.allocations,
                      [row.id]: {
                        ...(prev.allocations[row.id] ?? {}),
                        orderId: undefined,
                      },
                    },
                  }));
                }}
                inputProps={{
                  ref: (el) => {
                    allocationOrderRefs.current[row.id] = el;
                  },
                }}
              >
                {(item) => (
                  <AutocompleteItem key={item.id} textValue={`${item.orderCode} ${item.clientCode ?? ""} ${item.clientName ?? ""}`}>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.orderCode}</span>
                      <span className="text-xs text-default-500">
                        {item.clientCode ?? "-"} · {item.clientName ?? "-"}
                      </span>
                    </div>
                  </AutocompleteItem>
                )}
              </Autocomplete>

              <NumberInput
                id={`allocation-amount-${row.id}`}
                hideStepper
                isInvalid={Boolean(errors.allocations[row.id]?.amount)}
                errorMessage={errors.allocations[row.id]?.amount}
                label="Valor asignado"
                value={toNumberInputValue(row.amount)}
                formatOptions={{
                  style: "currency",
                  currency: "COP",
                  maximumFractionDigits: 2,
                }}
                onValueChange={(v) => {
                  const amount = toAmountString(v);
                  setAllocations((rows) =>
                    rows.map((item) =>
                      item.id === row.id ? { ...item, amount } : item,
                    ),
                  );
                  setErrors((prev) => ({
                    ...prev,
                    allocations: {
                      ...prev.allocations,
                      [row.id]: {
                        ...(prev.allocations[row.id] ?? {}),
                        amount: undefined,
                      },
                    },
                  }));
                }}
              />

              <div className="flex items-end">
                <Button color="danger" variant="light" onPress={() => removeRow(row.id)}>
                  <BsTrash />
                </Button>
              </div>
            </div>
          ))
            : null}

          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            <div className="rounded-medium border border-default-200 p-3">
              <div className="text-default-500">Consignación total</div>
              <div className="font-semibold">{depositTotal.toFixed(2)}</div>
            </div>
            <div className="rounded-medium border border-default-200 p-3">
              <div className="text-default-500">Total asignado</div>
              <div className="font-semibold">{assignedTotal.toFixed(2)}</div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button color="primary" isLoading={submitting} onPress={submit}>
              Registrar abono distribuido
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
