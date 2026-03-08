import { Input } from "@heroui/input";
import { Divider } from "@heroui/divider";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Card, CardBody } from "@heroui/card";
import { BsCreditCardFill, BsInfoCircle } from "react-icons/bs";

import { CLIENT_PRICE_TYPES, CLIENT_STATUSES } from "../client-modal.constants";
import type { FormState, SetFormState } from "../client-modal.types";

type Props = {
  form: FormState;
  setForm: SetFormState;
};

export function StatusCreditTab({ form, setForm }: Props) {
  return (
    <div className="space-y-4 py-4">
      <Select
        description="Este tipo aplica a la lista de precios en COP para prefacturas"
        label="Tipo de cliente para precios (COP)"
        selectedKeys={[form.priceClientType]}
        onChange={(e) =>
          setForm((s) => ({ ...s, priceClientType: e.target.value }))
        }
      >
        {CLIENT_PRICE_TYPES.map((item) => (
          <SelectItem key={item.value}>{item.label}</SelectItem>
        ))}
      </Select>

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
                  ℹ️ Cliente inactivo por defecto
                </p>
                <p className="text-xs text-info-800 mt-1">
                  Clientes nuevos comienzan inactivos hasta que tengan un estado jurídico definido como VIGENTE.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Divider className="my-4" />

      <div className="flex items-center justify-between rounded-lg border border-default-200 p-4">
        <div className="flex items-center gap-2">
          <BsCreditCardFill className="text-xl text-default-500" />
          <span className="text-sm">¿Tiene crédito aprobado?</span>
        </div>
        <Switch
          isSelected={form.hasCredit}
          onValueChange={(v) => setForm((s) => ({ ...s, hasCredit: v }))}
        />
      </div>

      {form.hasCredit && (
        <div className="space-y-4">
          <Input
            label="Número de pagaré"
            value={form.promissoryNoteNumber}
            onValueChange={(v) =>
              setForm((s) => ({ ...s, promissoryNoteNumber: v }))
            }
          />

          <Input
            label="Fecha firma pagaré"
            type="date"
            value={form.promissoryNoteDate}
            onValueChange={(v) =>
              setForm((s) => ({ ...s, promissoryNoteDate: v }))
            }
          />
        </div>
      )}
    </div>
  );
}
