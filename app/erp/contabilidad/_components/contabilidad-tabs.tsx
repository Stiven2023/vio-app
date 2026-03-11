"use client";

import { useState } from "react";
import { Tab, Tabs } from "@heroui/tabs";

import { PrefacturasTab } from "@/app/erp/prefacturas/_components/prefacturas-tab";
import { DepositsTab } from "@/app/erp/contabilidad/_components/consignaciones-tab";

export function AccountingTabs({
  canEdit,
  canApprovePayments,
}: {
  canEdit: boolean;
  canApprovePayments: boolean;
}) {
  const [selected, setSelected] = useState<"prefacturas" | "consignaciones">("prefacturas");

  return (
    <div className="space-y-4">
      <Tabs
        aria-label="Accounting modules"
        selectedKey={selected}
        variant="underlined"
        onSelectionChange={(key) =>
          setSelected(String(key) === "consignaciones" ? "consignaciones" : "prefacturas")
        }
      >
        <Tab key="prefacturas" title="Pre-invoices" />
        <Tab key="consignaciones" title="Deposits" />
      </Tabs>

      {selected === "prefacturas" ? (
        <PrefacturasTab
          canCreate={false}
          canDelete={false}
          canEdit={canEdit}
          initialStatus="PENDIENTE_CONTABILIDAD"
          lockStatusFilter
        />
      ) : (
        <DepositsTab canApprovePayments={canApprovePayments} />
      )}
    </div>
  );
}
