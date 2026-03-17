"use client";

import type { Key } from "react";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import NextLink from "next/link";

import { FileUpload } from "@/components/file-upload";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";

type OrderType = "VN" | "VI" | "VT" | "VW";

type ClientOption = {
  id: string;
  clientCode?: string | null;
  name: string;
  email?: string | null;
  identification: string | null;
  dv?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  country?: string | null;
  city?: string | null;
  postalCode?: string | null;
};

type ProductItem = {
  id: string;
  name: string | null;
  quantity: number;
  unitPrice: string | null;
  totalPrice: string | null;
  hasAdditions: boolean | null;
  status: string | null;
  confectionistName: string | null;
};

type PrefacturaFormMode = "create" | "edit";

type SupportedCurrency = "COP" | "USD";

export type PrefacturaFormData = {
  id?: string;
  prefacturaCode?: string | null;
  quoteCode?: string | null;
  orderId?: string | null;
  orderName?: string | null;
  orderType?: OrderType | null;
  currency?: SupportedCurrency | null;
  status?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  clientCode?: string | null;
  clientIdentification?: string | null;
  clientDv?: string | null;
  clientEmail?: string | null;
  clientContactName?: string | null;
  clientContactPhone?: string | null;
  clientAddress?: string | null;
  clientCountry?: string | null;
  clientCity?: string | null;
  clientPostalCode?: string | null;
  total?: string | null;
  subtotal?: string | null;
  advanceRequired?: string | null;
  advanceReceived?: string | null;
  advanceStatus?: string | null;
  advanceDate?: string | null;
  advancePaymentImageUrl?: string | null;
  advanceMethod?: string | null;
  advanceBankId?: string | null;
  advanceReferenceNumber?: string | null;
  advanceCurrency?: SupportedCurrency | null;
  hasConvenio?: boolean | null;
  convenioType?: string | null;
  convenioNotes?: string | null;
  convenioExpiresAt?: string | null;
  convenioImageUrl?: string | null;
  hasClientApproval?: boolean | null;
  clientApprovalDate?: string | null;
  clientApprovalBy?: string | null;
  clientApprovalNotes?: string | null;
  clientApprovalImageUrl?: string | null;
};

const typeOptions: Array<{ value: OrderType; label: string }> = [
  { value: "VN", label: "VN - Nacional" },
  { value: "VI", label: "VI - Internacional" },
  { value: "VT", label: "VT" },
  { value: "VW", label: "VW" },
];

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE_CONTABILIDAD: "Pendiente contabilidad",
  APROBACION: "Aprobacion",
  PROGRAMACION: "Programacion",
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  CANCELADA: "Cancelada",
  ANULADA: "Anulada",
};

const STATUS_COLOR: Record<
  string,
  "default" | "primary" | "success" | "warning" | "danger"
> = {
  PENDIENTE_CONTABILIDAD: "warning",
  APROBACION: "primary",
  PROGRAMACION: "primary",
  PENDIENTE: "default",
  APROBADA: "success",
  CANCELADA: "danger",
  ANULADA: "danger",
};

function normalizeCurrency(
  value: string | null | undefined,
): SupportedCurrency {
  return String(value ?? "COP")
    .trim()
    .toUpperCase() === "USD"
    ? "USD"
    : "COP";
}

function formatMoney(
  value: string | number | null | undefined,
  currency: SupportedCurrency,
): string {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n)) return "--";

  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-CO", {
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    style: "currency",
  }).format(n);
}

function toMoneyInputString(
  value: string | number | null | undefined,
  currency: SupportedCurrency,
): string {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n) || n <= 0) return "";

  if (currency === "USD") {
    return n
      .toFixed(2)
      .replace(/\.0+$/, "")
      .replace(/(\.\d*[1-9])0+$/, "$1");
  }

  return String(Math.round(n));
}

export function PrefacturaForm({
  mode,
  initial,
}: {
  mode: PrefacturaFormMode;
  initial?: PrefacturaFormData;
}) {
  const router = useRouter();

  const [orderName, setOrderName] = useState(initial?.orderName ?? "");
  const [orderType, setOrderType] = useState<OrderType>(
    initial?.orderType ?? "VN",
  );
  const [quotationCode, setQuotationCode] = useState(initial?.quoteCode ?? "");
  const [currency, setCurrency] = useState<SupportedCurrency>(
    normalizeCurrency(initial?.currency),
  );
  const [paymentTerms, setPaymentTerms] = useState("TRANSFERENCIA");

  const [clientQuery, setClientQuery] = useState(initial?.clientName ?? "");
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const selectedClient = clientOptions.find((c) => c.id === clientId) ?? null;

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [hasAdvance, setHasAdvance] = useState(
    Number(initial?.advanceRequired ?? 0) > 0,
  );
  const [advanceRequired] = useState(
    toMoneyInputString(
      initial?.advanceRequired,
      normalizeCurrency(initial?.currency),
    ),
  );
  const [advanceMethod, setAdvanceMethod] = useState<
    "EFECTIVO" | "TRANSFERENCIA" | ""
  >(
    initial?.advanceMethod === "EFECTIVO" ||
      initial?.advanceMethod === "TRANSFERENCIA"
      ? initial.advanceMethod
      : "",
  );

  const [hasClientApproval, setHasClientApproval] = useState(
    initial?.hasClientApproval ?? false,
  );
  const [clientApprovalBy, setClientApprovalBy] = useState(
    initial?.clientApprovalBy ?? "",
  );
  const [clientApprovalNotes, setClientApprovalNotes] = useState(
    initial?.clientApprovalNotes ?? "",
  );
  const [clientApprovalImageUrl, setClientApprovalImageUrl] = useState(
    initial?.clientApprovalImageUrl ?? "",
  );

  const [hasConvenio, setHasConvenio] = useState(initial?.hasConvenio ?? false);
  const [convenioType, setConvenioType] = useState(initial?.convenioType ?? "");
  const [convenioNotes, setConvenioNotes] = useState(
    initial?.convenioNotes ?? "",
  );
  const [convenioImageUrl, setConvenioImageUrl] = useState(
    initial?.convenioImageUrl ?? "",
  );

  const isCreationFromQuotation =
    mode === "create" && Boolean(quotationCode.trim());

  const [submitting, setSubmitting] = useState(false);

  const totalPrefactura = Number(initial?.total ?? 0);
  const halfTotal = totalPrefactura / 2;
  const requiredAdvanceValue = hasAdvance
    ? totalPrefactura > 0
      ? currency === "USD"
        ? Number(halfTotal.toFixed(2))
        : Math.round(halfTotal)
      : Number(advanceRequired || 0)
    : 0;

  useEffect(() => {
    if (mode !== "edit" || !initial?.orderId) return;
    setLoadingProducts(true);
    apiJson<{ items: ProductItem[] }>(
      `/api/orders/items?orderId=${initial.orderId}`,
    )
      .then((res) => setProducts(Array.isArray(res?.items) ? res.items : []))
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [mode, initial?.orderId]);

  const searchClients = async (q: string) => {
    setClientLoading(true);
    try {
      const res = await apiJson<{ items: ClientOption[] }>(
        `/api/clients?q=${encodeURIComponent(q.trim())}&pageSize=20`,
      );

      setClientOptions(Array.isArray(res?.items) ? res.items : []);
    } catch {
      setClientOptions([]);
    } finally {
      setClientLoading(false);
    }
  };

  const onClientInputChange = (value: string) => {
    setClientQuery(value);
    if (value.trim().length >= 2) searchClients(value);
    else setClientOptions([]);
  };

  const onClientSelect = (key: Key | null) => {
    const id = String(key ?? "");

    setClientId(id);
    const opt = clientOptions.find((c) => c.id === id);

    if (opt) setClientQuery(opt.name);
  };

  const cf = (
    searchField: keyof ClientOption,
    initialField: keyof PrefacturaFormData,
  ): string => {
    if (selectedClient)
      return String((selectedClient as any)[searchField] ?? "");

    return String((initial as any)?.[initialField] ?? "");
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const qCode = quotationCode.trim();
    const oName = orderName.trim();

    if (!qCode && !clientId) {
      toast.error("Ingresa el codigo de cotizacion o selecciona un cliente");

      return;
    }

    if (hasAdvance) {
      const amt = requiredAdvanceValue;

      if (!Number.isFinite(amt) || amt <= 0) {
        toast.error("Ingresa el monto del anticipo");

        return;
      }

      if (!advanceMethod) {
        toast.error("Selecciona el metodo del anticipo");

        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        const payload: Record<string, unknown> = {
          quotationCode: qCode || undefined,
          clientId: qCode ? undefined : clientId,
          orderName: oName || undefined,
          orderType,
          currency,
          advanceRequired: hasAdvance ? requiredAdvanceValue : 0,
          advanceMethod: hasAdvance ? advanceMethod : null,
          hasConvenio,
          convenioType: hasConvenio ? convenioType.trim() || null : null,
          convenioNotes: hasConvenio ? convenioNotes.trim() || null : null,
          convenioImageUrl: hasConvenio ? convenioImageUrl || null : null,
          hasClientApproval,
          clientApprovalBy: hasClientApproval
            ? clientApprovalBy.trim() || null
            : null,
          clientApprovalNotes: hasClientApproval
            ? clientApprovalNotes.trim() || null
            : null,
          clientApprovalImageUrl: hasClientApproval
            ? clientApprovalImageUrl || null
            : null,
        };

        const created = await apiJson<{ prefactura?: { id?: string } }>(
          "/api/prefacturas",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );

        toast.success(
          isCreationFromQuotation
            ? "Prefactura de cotizacion lista para edicion"
            : "Prefactura creada",
        );

        if (created?.prefactura?.id) {
          router.push(`/erp/prefacturas/${created.prefactura.id}/edit`);
        } else {
          router.push("/erp/prefacturas");
        }
      } else {
        if (!initial?.id) return;

        await apiJson(`/api/prefacturas/${initial.id}`, {
          method: "PUT",
          body: JSON.stringify({
            orderName: oName || undefined,
            orderType,
            currency,
          }),
        });

        await apiJson(`/api/prefacturas/${initial.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            advanceRequired: hasAdvance ? requiredAdvanceValue : 0,
            advanceMethod: hasAdvance ? advanceMethod : null,
            hasConvenio,
            convenioType: hasConvenio ? convenioType.trim() || null : null,
            convenioNotes: hasConvenio ? convenioNotes.trim() || null : null,
            convenioImageUrl: hasConvenio ? convenioImageUrl || null : null,
            hasClientApproval,
            clientApprovalBy: hasClientApproval
              ? clientApprovalBy.trim() || null
              : null,
            clientApprovalNotes: hasClientApproval
              ? clientApprovalNotes.trim() || null
              : null,
            clientApprovalImageUrl: hasClientApproval
              ? clientApprovalImageUrl || null
              : null,
          }),
        });

        toast.success("Prefactura actualizada");
        router.push("/erp/prefacturas");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const showClientSearch = mode === "create" && !quotationCode.trim();
  const statusVal = initial?.status ?? "PENDIENTE_CONTABILIDAD";

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {mode === "create" ? "Nueva prefactura" : "Editar prefactura"}
          </h1>
          {initial?.prefacturaCode ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-default-500">
              <span>Codigo:</span>
              <Chip color="primary" size="sm" variant="flat">
                {initial.prefacturaCode}
              </Chip>
              {initial.quoteCode ? (
                <>
                  <span>Cotizacion:</span>
                  <Chip color="default" size="sm" variant="bordered">
                    {initial.quoteCode}
                  </Chip>
                </>
              ) : null}
              <span>Estado:</span>
              <Chip
                color={STATUS_COLOR[statusVal] ?? "default"}
                size="sm"
                variant="flat"
              >
                {STATUS_LABEL[statusVal] ?? statusVal}
              </Chip>
            </div>
          ) : (
            <p className="mt-0.5 text-sm text-default-500">
              Se asignara al guardar
            </p>
          )}
        </div>
        <Button
          as={NextLink}
          href="/erp/prefacturas"
          isDisabled={submitting}
          variant="flat"
        >
          Volver
        </Button>
      </div>

      <Card className="border border-default-200" radius="md" shadow="none">
        <CardHeader className="text-sm font-semibold">
          Informacion general
        </CardHeader>
        <Divider />
        <CardBody className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Input
            isReadOnly
            label="Codigo Cliente"
            value={cf("clientCode", "clientCode")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="Email"
            value={cf("email", "clientEmail")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="NIT / CC"
            value={cf("identification", "clientIdentification")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="DV"
            value={cf("dv", "clientDv")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="Nombre Contacto"
            value={cf("contactName", "clientContactName")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="Telefono Contacto"
            value={cf("contactPhone", "clientContactPhone")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="Direccion"
            value={cf("address", "clientAddress")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="Pais"
            value={cf("country", "clientCountry") || "COLOMBIA"}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="Ciudad"
            value={cf("city", "clientCity")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="Codigo Postal"
            value={cf("postalCode", "clientPostalCode")}
            variant="bordered"
          />

          <Select
            label="Moneda"
            selectedKeys={[currency]}
            variant="bordered"
            onSelectionChange={(keys) => {
              const first = String(Array.from(keys)[0] ?? "COP");

              setCurrency(first === "USD" ? "USD" : "COP");
            }}
          >
            <SelectItem key="COP">COP</SelectItem>
            <SelectItem key="USD">USD</SelectItem>
          </Select>

          <div className="space-y-4 lg:col-span-3">
            {mode === "create" ? (
              <Input
                description="Deja en blanco para crear sin cotizacion vinculada"
                label="Codigo de cotizacion"
                placeholder="Ej: COT-10001"
                value={quotationCode}
                variant="bordered"
                onValueChange={setQuotationCode}
              />
            ) : (
              <Input
                isReadOnly
                label="Codigo de cotizacion"
                value={initial?.quoteCode ?? "Sin cotizacion"}
                variant="bordered"
              />
            )}

            {showClientSearch ? (
              <Autocomplete
                defaultItems={clientOptions}
                inputValue={clientQuery}
                isLoading={clientLoading}
                label="Cliente"
                placeholder="Busca por nombre o NIT..."
                selectedKey={clientId || null}
                variant="bordered"
                onInputChange={onClientInputChange}
                onSelectionChange={onClientSelect}
              >
                {(item) => (
                  <AutocompleteItem
                    key={item.id}
                    textValue={`${item.name} ${item.identification ?? ""}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{item.name}</span>
                      {item.identification ? (
                        <span className="text-xs text-default-500">
                          {item.identification}
                        </span>
                      ) : null}
                    </div>
                  </AutocompleteItem>
                )}
              </Autocomplete>
            ) : mode === "edit" ? (
              <Input
                isReadOnly
                label="Cliente"
                value={initial?.clientName ?? "---"}
                variant="bordered"
              />
            ) : null}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Input
                label="Nombre del pedido"
                placeholder="Ej: Pedido empresa XYZ"
                value={orderName}
                variant="bordered"
                onValueChange={setOrderName}
              />
              <Select
                label="Tipo de pedido"
                selectedKeys={[orderType]}
                variant="bordered"
                onSelectionChange={(keys) => {
                  const first = String(
                    Array.from(keys)[0] ?? "VN",
                  ) as OrderType;

                  setOrderType(
                    first === "VI" || first === "VT" || first === "VW"
                      ? first
                      : "VN",
                  );
                }}
              >
                {typeOptions.map((opt) => (
                  <SelectItem key={opt.value}>{opt.label}</SelectItem>
                ))}
              </Select>
            </div>

            <Select
              label="Condiciones de pago"
              selectedKeys={[paymentTerms]}
              variant="bordered"
              onSelectionChange={(keys) => {
                const first = String(Array.from(keys)[0] ?? "TRANSFERENCIA");

                setPaymentTerms(first || "TRANSFERENCIA");
              }}
            >
              <SelectItem key="TRANSFERENCIA">Transferencia</SelectItem>
              <SelectItem key="EFECTIVO">Efectivo</SelectItem>
              <SelectItem key="CREDITO">Credito</SelectItem>
            </Select>
          </div>
        </CardBody>
      </Card>

      {mode === "edit" && initial?.orderId ? (
        <Card className="border border-default-200" radius="md" shadow="none">
          <CardHeader className="flex items-center justify-between text-sm font-semibold">
            <span>Productos del pedido</span>
            {initial.total ? (
              <div className="flex items-center gap-4 text-xs font-normal">
                <span className="text-default-500">
                  Subtotal:{" "}
                  <strong className="text-default-700">
                    {formatMoney(initial.subtotal, currency)}
                  </strong>
                </span>
                <span className="font-semibold text-default-800">
                  Total:{" "}
                  <strong className="text-primary">
                    {formatMoney(initial.total, currency)}
                  </strong>
                </span>
              </div>
            ) : null}
          </CardHeader>
          <Divider />
          <CardBody className="px-0 py-0">
            {loadingProducts ? (
              <p className="px-4 py-6 text-sm text-default-400">
                Cargando productos...
              </p>
            ) : products.length === 0 ? (
              <p className="px-4 py-6 text-sm text-default-400">
                Sin items registrados en este pedido.
              </p>
            ) : (
              <Table
                aria-label="Productos de la prefactura"
                classNames={{ wrapper: "rounded-none shadow-none" }}
              >
                <TableHeader>
                  <TableColumn>Diseno / Producto</TableColumn>
                  <TableColumn className="text-right">Cant.</TableColumn>
                  <TableColumn className="text-right">Precio unit.</TableColumn>
                  <TableColumn className="text-right">Total</TableColumn>
                  <TableColumn>Adiciones</TableColumn>
                  <TableColumn>Estado</TableColumn>
                  <TableColumn>Confeccionista</TableColumn>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name ?? "---"}</TableCell>
                      <TableCell className="text-right">{p.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(p.unitPrice, currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(p.totalPrice, currency)}
                      </TableCell>
                      <TableCell>
                        {p.hasAdditions ? (
                          <Chip color="secondary" size="sm" variant="flat">
                            Si
                          </Chip>
                        ) : (
                          <span className="text-xs text-default-400">No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.status ? (
                          <Chip size="sm" variant="flat">
                            {p.status}
                          </Chip>
                        ) : (
                          "---"
                        )}
                      </TableCell>
                      <TableCell>
                        {p.confectionistName ?? (
                          <span className="text-xs text-default-400">
                            Sin asignar
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border border-default-200" radius="md" shadow="none">
          <CardHeader className="flex items-center justify-between">
            <span className="text-sm font-semibold">Anticipo</span>
            <Switch
              isSelected={hasAdvance}
              size="sm"
              onValueChange={setHasAdvance}
            >
              <span className="text-xs text-default-500">
                {hasAdvance ? "Con anticipo" : "Sin anticipo"}
              </span>
            </Switch>
          </CardHeader>
          <Divider />
          {hasAdvance ? (
            <CardBody className="space-y-3">
              {totalPrefactura > 0 ? (
                <div className="space-y-1 rounded-lg bg-default-50 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-default-500">Total prefactura</span>
                    <span className="font-semibold">
                      {formatMoney(totalPrefactura, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-primary">
                    <span>50% para programacion</span>
                    <span className="font-semibold">
                      {formatMoney(halfTotal, currency)}
                    </span>
                  </div>
                </div>
              ) : null}
              <Select
                label="Metodo de pago"
                selectedKeys={advanceMethod ? [advanceMethod] : []}
                variant="bordered"
                onSelectionChange={(keys) => {
                  const first = String(Array.from(keys)[0] ?? "");

                  setAdvanceMethod(
                    first === "EFECTIVO" || first === "TRANSFERENCIA"
                      ? first
                      : "",
                  );
                }}
              >
                <SelectItem key="EFECTIVO">Efectivo</SelectItem>
                <SelectItem key="TRANSFERENCIA">Transferencia</SelectItem>
              </Select>

              {mode === "edit" ? (
                <>
                  <Divider />
                  <p className="rounded-lg border border-primary-200 bg-primary-50 p-3 text-xs text-primary-700">
                    El pago del anticipo ahora se registra desde el listado de
                    prefacturas en Acciones &gt; Realizar anticipo.
                  </p>
                  <div className="rounded-lg border border-default-200 bg-default-50 p-3 text-xs text-default-600">
                    <div className="flex justify-between gap-3">
                      <span>Meta minima</span>
                      <strong>
                        {formatMoney(requiredAdvanceValue, currency)}
                      </strong>
                    </div>
                  </div>
                </>
              ) : null}
            </CardBody>
          ) : (
            <CardBody>
              <p className="text-xs text-default-400">
                Sin anticipo registrado.
              </p>
            </CardBody>
          )}
        </Card>

        <Card className="border border-default-200" radius="md" shadow="none">
          <CardHeader className="flex items-center justify-between">
            <span className="text-sm font-semibold">Aval del cliente</span>
            <Switch
              isSelected={hasClientApproval}
              size="sm"
              onValueChange={setHasClientApproval}
            >
              <span className="text-xs text-default-500">
                {hasClientApproval ? "Avalado" : "Sin aval"}
              </span>
            </Switch>
          </CardHeader>
          <Divider />
          {hasClientApproval ? (
            <CardBody className="space-y-3">
              <Input
                label="Fuente del aval"
                placeholder="Ej: WhatsApp, correo, llamada..."
                value={clientApprovalBy}
                variant="bordered"
                onValueChange={setClientApprovalBy}
              />
              <Textarea
                label="Observaciones"
                minRows={2}
                placeholder="Detalles del aval, condiciones, acuerdos..."
                value={clientApprovalNotes}
                variant="bordered"
                onValueChange={setClientApprovalNotes}
              />
              <FileUpload
                acceptedFileTypes="image/*"
                label="Imagen / evidencia del aval"
                uploadFolder="prefacturas/avales"
                value={clientApprovalImageUrl}
                onChange={setClientApprovalImageUrl}
                onClear={() => setClientApprovalImageUrl("")}
              />
            </CardBody>
          ) : (
            <CardBody>
              <p className="text-xs text-default-400">
                El cliente aun no ha dado aval formal.
              </p>
            </CardBody>
          )}
        </Card>

        <Card className="border border-default-200" radius="md" shadow="none">
          <CardHeader className="flex items-center justify-between">
            <span className="text-sm font-semibold">Convenio comercial</span>
            <Switch
              isSelected={hasConvenio}
              size="sm"
              onValueChange={setHasConvenio}
            >
              <span className="text-xs text-default-500">
                {hasConvenio ? "Con convenio" : "Sin convenio"}
              </span>
            </Switch>
          </CardHeader>
          <Divider />
          {hasConvenio ? (
            <CardBody className="space-y-3">
              <Input
                label="Tipo de convenio"
                placeholder="Ej: Credito 30 dias"
                value={convenioType}
                variant="bordered"
                onValueChange={setConvenioType}
              />
              <Textarea
                label="Notas"
                minRows={2}
                placeholder="Condiciones, excepciones, acuerdos..."
                value={convenioNotes}
                variant="bordered"
                onValueChange={setConvenioNotes}
              />
              <FileUpload
                acceptedFileTypes="image/*"
                label="Imagen / documento del convenio"
                uploadFolder="prefacturas/convenios"
                value={convenioImageUrl}
                onChange={setConvenioImageUrl}
                onClear={() => setConvenioImageUrl("")}
              />
            </CardBody>
          ) : (
            <CardBody>
              <p className="text-xs text-default-400">Sin convenio activo.</p>
            </CardBody>
          )}
        </Card>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          as={NextLink}
          href="/erp/prefacturas"
          isDisabled={submitting}
          variant="flat"
        >
          Cancelar
        </Button>
        <Button color="primary" isLoading={submitting} onPress={handleSubmit}>
          {mode === "create" ? "Crear prefactura" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
