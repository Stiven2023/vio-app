import type { FormState, SetFormState } from "../client-modal.types";

import { Input } from "@heroui/input";
import { Divider } from "@heroui/divider";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Card, CardBody } from "@heroui/card";
import { BsCreditCardFill, BsInfoCircle } from "react-icons/bs";

import { CLIENT_STATUSES } from "../client-modal.constants";

type Props = {
  form: FormState;
  setForm: SetFormState;
  errors?: Record<string, string>;
};

const TAX_ZONE_OPTIONS = [
  { value: "CONTINENTAL", label: "Continental" },
  { value: "FREE_ZONE", label: "Free Zone" },
  { value: "SAN_ANDRES", label: "San Andrés" },
  { value: "SPECIAL_REGIME", label: "Special Regime" },
] as const;

const PAYMENT_TYPE_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "CREDIT", label: "Credit" },
] as const;

const CREDIT_BACKING_OPTIONS = [
  { value: "PROMISSORY_NOTE", label: "Promissory note" },
  { value: "PURCHASE_ORDER", label: "Purchase order" },
  { value: "VERBAL_AGREEMENT", label: "Verbal agreement" },
] as const;

function taxZoneMessage(taxZone: FormState["taxZone"]) {
  if (taxZone === "FREE_ZONE") {
    return "FREE_ZONE: Differential rate or export regime";
  }
  if (taxZone === "SAN_ANDRES") {
    return "SAN_ANDRES: Special regime, standard IVA does not apply";
  }
  if (taxZone === "SPECIAL_REGIME") {
    return "SPECIAL_REGIME: Consult withholding rate table";
  }

  return "CONTINENTAL: Standard IVA 19%";
}

export function StatusCreditTab({ form, setForm, errors = {} }: Props) {
  return (
    <div className="space-y-4 py-4">
      <Select
        label="Estado del cliente"
        selectedKeys={[form.status]}
        onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
      >
        {CLIENT_STATUSES.map((item) => (
          <SelectItem key={item.value}>{item.label}</SelectItem>
        ))}
      </Select>

      <div className="flex items-center justify-between rounded-lg border border-default-200 p-4">
        <span className="text-sm">Cliente activo (interno)</span>
        <Switch
          isSelected={form.isActive}
          onValueChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
        />
      </div>

      {!form.isActive && (
        <Card className="bg-info-50 border border-info-200">
          <CardBody className="gap-2 p-3">
            <div className="flex items-start gap-2">
              <BsInfoCircle className="text-lg text-info-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-info-900">
                  ℹ️ Cliente inactivo
                </p>
                <p className="text-xs text-info-800 mt-1">
                  Los clientes inactivos no aparecerán para crear cotizaciones,
                  prefacturas ni pedidos.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Divider className="my-4" />

      <Card className="border border-default-200">
        <CardBody className="space-y-4">
          <div className="flex items-center gap-2">
            <BsCreditCardFill className="text-xl text-default-500" />
            <span className="text-sm font-semibold">
              Fiscal & Credit Information
            </span>
          </div>

          <Input
            errorMessage={errors.municipalityFiscal}
            isInvalid={Boolean(errors.municipalityFiscal)}
            label="Municipality fiscal"
            value={form.municipalityFiscal}
            onValueChange={(value) =>
              setForm((s) => ({ ...s, municipalityFiscal: value }))
            }
          />

          <Select
            isRequired
            errorMessage={errors.taxZone}
            isInvalid={Boolean(errors.taxZone)}
            label="Tax zone"
            selectedKeys={[form.taxZone]}
            onChange={(e) =>
              setForm((s) => ({
                ...s,
                taxZone: e.target.value as FormState["taxZone"],
              }))
            }
          >
            {TAX_ZONE_OPTIONS.map((item) => (
              <SelectItem key={item.value}>{item.label}</SelectItem>
            ))}
          </Select>

          <div className="rounded-lg border border-info-200 bg-info-50 p-3 text-sm text-info-800">
            {taxZoneMessage(form.taxZone)}
          </div>

          <Select
            isRequired
            errorMessage={errors.paymentType}
            isInvalid={Boolean(errors.paymentType)}
            label="Payment type"
            selectedKeys={[form.paymentType]}
            onChange={(e) =>
              setForm((s) => ({
                ...s,
                paymentType: e.target.value as FormState["paymentType"],
              }))
            }
          >
            {PAYMENT_TYPE_OPTIONS.map((item) => (
              <SelectItem key={item.value}>{item.label}</SelectItem>
            ))}
          </Select>

          {form.paymentType === "CREDIT" ? (
            <>
              <div className="flex items-center justify-between rounded-lg border border-default-200 p-4">
                <span className="text-sm">Has credit</span>
                <Switch
                  isSelected={form.hasCredit}
                  onValueChange={(value) =>
                    setForm((s) => ({ ...s, hasCredit: value }))
                  }
                />
              </div>

              <Input
                errorMessage={errors.creditLimit}
                isInvalid={Boolean(errors.creditLimit)}
                isRequired={form.hasCredit}
                label="Credit limit"
                placeholder="Ej: 5000000"
                type="number"
                value={form.creditLimit}
                onValueChange={(value) =>
                  setForm((s) => ({ ...s, creditLimit: value }))
                }
              />

              <Select
                errorMessage={errors.creditBackingType}
                isInvalid={Boolean(errors.creditBackingType)}
                isRequired={form.hasCredit}
                label="Credit backing type"
                selectedKeys={
                  form.creditBackingType ? [form.creditBackingType] : []
                }
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    creditBackingType: e.target
                      .value as FormState["creditBackingType"],
                  }))
                }
              >
                {CREDIT_BACKING_OPTIONS.map((item) => (
                  <SelectItem key={item.value}>{item.label}</SelectItem>
                ))}
              </Select>

              <Input
                errorMessage={errors.promissoryNoteNumber}
                isInvalid={Boolean(errors.promissoryNoteNumber)}
                label="Promissory note number"
                value={form.promissoryNoteNumber}
                onValueChange={(value) =>
                  setForm((s) => ({ ...s, promissoryNoteNumber: value }))
                }
              />

              <Input
                errorMessage={errors.promissoryNoteDate}
                isInvalid={Boolean(errors.promissoryNoteDate)}
                label="Promissory note date"
                type="date"
                value={form.promissoryNoteDate}
                onValueChange={(value) =>
                  setForm((s) => ({ ...s, promissoryNoteDate: value }))
                }
              />
            </>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
