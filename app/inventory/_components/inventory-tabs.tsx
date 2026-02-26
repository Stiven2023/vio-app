"use client";

import { useState } from "react";
import { Tab, Tabs } from "@heroui/tabs";

import { InventoryEntriesTab } from "@/app/catalog/_components/inventory-entries/inventory-entries-tab";
import { InventoryItemsTab } from "@/app/catalog/_components/inventory-items/inventory-items-tab";
import { InventoryOutputsTab } from "@/app/catalog/_components/inventory-outputs/inventory-outputs-tab";

type InventoryTabKey = "inventory" | "entries" | "outputs";

export function InventoryTabs({
  canCreateItem,
  canEditItem,
  canDeleteItem,
  canEntry,
  canOutput,
  canViewInventoryItems,
}: {
  canCreateItem: boolean;
  canEditItem: boolean;
  canDeleteItem: boolean;
  canEntry: boolean;
  canOutput: boolean;
  canViewInventoryItems: boolean;
}) {
  const firstTab: InventoryTabKey = canViewInventoryItems
    ? "inventory"
    : canEntry
      ? "entries"
      : "outputs";

  const [activeTab, setActiveTab] = useState<InventoryTabKey>(firstTab);

  return (
    <div>
      <Tabs
        aria-label="Inventario"
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as InventoryTabKey)}
      >
        {canViewInventoryItems ? <Tab key="inventory" title="Inventario" /> : null}
        {canEntry ? <Tab key="entries" title="Entradas" /> : null}
        {canOutput ? <Tab key="outputs" title="Salidas" /> : null}
      </Tabs>

      <div className="mt-4">
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
