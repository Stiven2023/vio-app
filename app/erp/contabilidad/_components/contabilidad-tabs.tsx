"use client";

import { Tab, Tabs } from "@heroui/tabs";

import { CommissionRatesTab } from "@/app/erp/contabilidad/_components/commission-rates-tab";
import { DepositsTab } from "@/app/erp/contabilidad/_components/consignaciones-tab";

export function AccountingTabs({
  canEdit,
  canApprovePayments,
}: {
  canEdit: boolean;
  canApprovePayments: boolean;
}) {
  return (
    <Tabs aria-label="Contabilidad" variant="underlined">
      <Tab key="deposits" title="Depósitos">
        <div className="pt-4">
          <DepositsTab canApprovePayments={canApprovePayments} />
        </div>
      </Tab>
      <Tab key="commissions" title="Comisiones">
        <div className="pt-4">
          <CommissionRatesTab canEdit={canEdit} />
        </div>
      </Tab>
    </Tabs>
  );
}
