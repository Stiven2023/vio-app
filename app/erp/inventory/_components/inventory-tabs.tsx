"use client";

import { useState } from "react";
import { Tab, Tabs } from "@heroui/tabs";

import { InventoryEntriesTab } from "@/app/erp/catalog/_components/inventory-entries/inventory-entries-tab";
import { InventoryItemsTab } from "@/app/erp/catalog/_components/inventory-items/inventory-items-tab";
import { InventoryOutputsTab } from "@/app/erp/catalog/_components/inventory-outputs/inventory-outputs-tab";
import { WarehousesTab } from "@/app/erp/inventory/_components/warehouses-tab";

type InventoryTabKey = "warehouses" | "inventory" | "entries" | "outputs";

export function InventoryTabs({
  canCreateItem,
  canEditItem,
  canDeleteItem,
  canEntry,
  canOutput,
  canViewInventoryItems,
  canViewWarehouses,
  canManageWarehouses,
}: {
  canCreateItem: boolean;
  canEditItem: boolean;
  canDeleteItem: boolean;
  canEntry: boolean;
  canOutput: boolean;
  canViewInventoryItems: boolean;
  canViewWarehouses: boolean;
  canManageWarehouses: boolean;
}) {
  const firstTab: InventoryTabKey =
    canManageWarehouses || canViewWarehouses
      ? "warehouses"
      : canViewInventoryItems
        ? "inventory"
        : canEntry
          ? "entries"
          : "outputs";

  const canSeeWarehouses = canViewWarehouses || canManageWarehouses;
  const [activeTab, setActiveTab] = useState<InventoryTabKey>(firstTab);

  return (
    <div>
      <Tabs
        aria-label="Inventario"
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as InventoryTabKey)}
      >
        {canSeeWarehouses ? <Tab key="warehouses" title="Bodegas" /> : null}
        {canViewInventoryItems ? (
          <Tab key="inventory" title="Inventario" />
        ) : null}
        {canEntry ? <Tab key="entries" title="Entradas" /> : null}
        {canOutput ? <Tab key="outputs" title="Salidas" /> : null}
      </Tabs>

      <div className="mt-4">
        {activeTab === "warehouses" && canSeeWarehouses ? (
          <WarehousesTab canManage={canManageWarehouses} />
        ) : null}
        {activeTab === "inventory" && canViewInventoryItems ? (
          <InventoryItemsTab
            canCreate={canCreateItem}
            canDelete={canDeleteItem}
            canEdit={canEditItem}
          />
        ) : null}
        {activeTab === "entries" && canEntry ? (
          <InventoryEntriesTab
            canCreate={canEntry}
            canDelete={canEntry}
            canEdit={canEntry}
          />
        ) : null}
        {activeTab === "outputs" && canOutput ? (
          <InventoryOutputsTab
            canCreate={canOutput}
            canDelete={canOutput}
            canEdit={canOutput}
          />
        ) : null}
      </div>
    </div>
  );
}
