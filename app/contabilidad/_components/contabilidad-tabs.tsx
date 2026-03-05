"use client";

import { useState } from "react";
import { Tab, Tabs } from "@heroui/tabs";

import { PrefacturasTab } from "@/app/prefacturas/_components/prefacturas-tab";
import { ConsignacionesTab } from "@/app/contabilidad/_components/consignaciones-tab";

export function ContabilidadTabs({
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
        aria-label="Módulos de contabilidad"
        selectedKey={selected}
        variant="underlined"
        onSelectionChange={(key) =>
          setSelected(String(key) === "consignaciones" ? "consignaciones" : "prefacturas")
        }
      >
        <Tab key="prefacturas" title="Prefacturas" />
        <Tab key="consignaciones" title="Consignaciones" />
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
        <ConsignacionesTab canApprovePayments={canApprovePayments} />
      )}
    </div>
  );
}
