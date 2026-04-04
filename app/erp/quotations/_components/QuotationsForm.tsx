"use client";

import type { ClientOption, QuoteForm } from "../_lib/types";

import { Input } from "@heroui/input";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Select, SelectItem } from "@heroui/select";
import { Skeleton } from "@heroui/skeleton";

import {
  DEFAULT_COUNTRY,
  getClientPriceTypeOptions,
  getPaymentTermOptions,
  QUOTATION_COPY,
} from "../_lib/constants";
import { useClientOnly } from "../_hooks/useClientOnly";
import { useQuotationUiLocale } from "../_hooks/useQuotationUiLocale";

type QuotationsFormProps = {
  form: QuoteForm;
  clients: ClientOption[];
  loadingClients: boolean;
  onFormChange: (updates: Partial<QuoteForm>) => void;
};

export function QuotationsForm({
  form,
  clients,
  loadingClients,
  onFormChange,
}: QuotationsFormProps) {
  const locale = useQuotationUiLocale();
  const copy = QUOTATION_COPY[locale];
  const clientPriceTypeOptions = getClientPriceTypeOptions(locale);
  const paymentTermOptions = getPaymentTermOptions(locale);
  const isMounted = useClientOnly();
  const clientsWithCode = clients.filter((client) =>
    Boolean(client.clientCode),
  );
  const selectedClient =
    clients.find((client) => client.id === form.clientId) ?? null;
  const requiresCreditValidation = form.paymentTerms === "CREDITO";
  const hasActiveCredit = Boolean(selectedClient?.hasCredit);
  const clientPromissoryNumber = String(
    selectedClient?.promissoryNoteNumber ?? "",
  ).trim();
  const creditInvalid =
    requiresCreditValidation && (!hasActiveCredit || !clientPromissoryNumber);

  const handleClientSelect = (clientId: string) => {
    const selected = clients.find((client) => client.id === clientId);
    // Si es CE, PAS o EMPRESA_EXTERIOR, USD por defecto; si no, COP
    const isInternational = ["CE", "PAS", "EMPRESA_EXTERIOR"].includes(
      String(selected?.identificationType ?? ""),
    );

    onFormChange({
      clientId,
      documentType: "F", // Default to F (Factura) on client change
      customerName: selected?.name ?? "",
      customerEmail: selected?.email ?? "",
      documentNumber: selected?.identification ?? "",
      documentVerificationDigit: selected?.dv ?? "",
      address: selected?.address ?? "",
      country: selected?.country ?? DEFAULT_COUNTRY,
      city: selected?.city ?? "",
      postalCode: selected?.postalCode ?? "",
      contactName: selected?.contactName ?? "",
      contactPhone: selected?.contactPhone ?? "",
      currency: isInternational ? "USD" : "COP",
      promissoryNoteNumber: selected?.promissoryNoteNumber ?? "",
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {isMounted ? (
          <Autocomplete
            classNames={{
              base: "min-h-12",
              selectorButton: "min-h-12",
            }}
            defaultItems={clientsWithCode}
            isLoading={loadingClients}
            label={copy.form.clientCode}
            selectedKey={form.clientId || null}
            variant="bordered"
            onSelectionChange={(key) => {
              handleClientSelect(String(key ?? ""));
            }}
          >
            {clientsWithCode.map((client) => (
              <AutocompleteItem
                key={client.id}
                textValue={String(client.clientCode ?? "")}
              >
                {String(client.clientCode ?? "")}
              </AutocompleteItem>
            ))}
          </Autocomplete>
        ) : (
          <Skeleton className="rounded-lg h-12" />
        )}
        {isMounted ? (
          <Select
            classNames={{ trigger: "min-h-12" }}
            label={copy.form.documentType}
            selectedKeys={[form.documentType]}
            variant="bordered"
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              onFormChange({
                documentType: String(first) === "R" ? "R" : "F",
              });
            }}
          >
            <SelectItem key="F">F</SelectItem>
            <SelectItem key="R">R</SelectItem>
          </Select>
        ) : (
          <Skeleton className="rounded-lg h-12" />
        )}
        <Input
          label={copy.form.email}
          type="email"
          value={form.customerEmail}
          variant="bordered"
          onValueChange={(v) => onFormChange({ customerEmail: v })}
        />
        <Input
          isReadOnly
          label={copy.form.documentNumber}
          value={form.documentNumber}
          variant="bordered"
        />
        <Input
          isReadOnly
          label={copy.form.verificationDigit}
          value={form.documentVerificationDigit}
          variant="bordered"
        />
        <Input
          isReadOnly
          label={copy.form.contactName}
          value={form.contactName}
          variant="bordered"
        />
        <Input
          isReadOnly
          label={copy.form.contactPhone}
          type="tel"
          value={form.contactPhone}
          variant="bordered"
        />
        <Input
          isReadOnly
          label={copy.form.address}
          value={form.address}
          variant="bordered"
        />
        <Input
          isReadOnly
          label={copy.form.country}
          value={form.country}
          variant="bordered"
        />
        <Input
          isReadOnly
          label={copy.form.city}
          value={form.city}
          variant="bordered"
        />
        <Input
          isReadOnly
          label={copy.form.postalCode}
          value={form.postalCode}
          variant="bordered"
        />
        <Input
          isReadOnly
          label={copy.form.seller}
          value={form.seller}
          variant="bordered"
        />
        {isMounted ? (
          <Select
            classNames={{ trigger: "min-h-12" }}
            isDisabled={form.currency !== "COP"}
            label={copy.form.clientType}
            selectedKeys={
              form.clientPriceTypeDisplay ? [form.clientPriceTypeDisplay] : []
            }
            variant="bordered"
            onSelectionChange={(keys) => {
              const first = String(Array.from(keys)[0] ?? "VIOMAR");

              onFormChange({
                clientPriceTypeDisplay:
                  first === "AUTORIZADO" ||
                  first === "MAYORISTA" ||
                  first === "VIOMAR" ||
                  first === "COLANTA"
                    ? first
                    : "VIOMAR",
              });
            }}
          >
            {clientPriceTypeOptions.map((option) => (
              <SelectItem key={option.value}>{option.label}</SelectItem>
            ))}
          </Select>
        ) : (
          <Skeleton className="rounded-lg h-12" />
        )}
        {isMounted ? (
          <Select
            classNames={{ trigger: "min-h-12" }}
            label={copy.form.currency}
            selectedKeys={[form.currency]}
            variant="bordered"
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              onFormChange({
                currency: String(first) === "USD" ? "USD" : "COP",
              });
            }}
          >
            <SelectItem key="COP">COP</SelectItem>
            <SelectItem key="USD">USD</SelectItem>
          </Select>
        ) : (
          <Skeleton className="rounded-lg h-12" />
        )}
        <Input
          isReadOnly
          label={copy.form.expirationDate}
          type="date"
          value={form.expiryDate}
          variant="bordered"
        />
        {isMounted ? (
          <Select
            classNames={{ trigger: "min-h-12" }}
            errorMessage={
              creditInvalid
                ? !hasActiveCredit
                  ? copy.form.activeCreditError
                  : copy.form.promissoryError
                : undefined
            }
            isInvalid={creditInvalid}
            label={copy.form.paymentTerms}
            selectedKeys={form.paymentTerms ? [form.paymentTerms] : []}
            variant="bordered"
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              onFormChange({
                paymentTerms:
                  first === "EFECTIVO" ||
                  first === "TARJETA" ||
                  first === "CHEQUE" ||
                  first === "CREDITO" ||
                  first === "OTROS" ||
                  first === "TRANSFERENCIA"
                    ? first
                    : "TRANSFERENCIA",
              });
            }}
          >
            {paymentTermOptions.map((option) => (
              <SelectItem key={option.value}>{option.label}</SelectItem>
            ))}
          </Select>
        ) : (
          <Skeleton className="rounded-lg h-12" />
        )}
        <div className={form.paymentTerms === "CREDITO" ? "block" : "hidden"}>
          <Input
            isReadOnly
            errorMessage={
              form.paymentTerms === "CREDITO" && !clientPromissoryNumber
                ? copy.form.promissoryError
                : undefined
            }
            isInvalid={form.paymentTerms === "CREDITO" && !clientPromissoryNumber}
            label={copy.form.promissoryNote}
            value={clientPromissoryNumber || form.promissoryNoteNumber}
            variant="bordered"
          />
        </div>
      </div>
    </div>
  );
}
