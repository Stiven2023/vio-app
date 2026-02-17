"use client";

import { useState } from "react";
import { Tabs, Tab } from "@heroui/tabs";

import { CategoriesTab } from "./categories/categories-tab";
import { InventoryItemsTab } from "./inventory-items/inventory-items-tab";
import { InventoryEntriesTab } from "./inventory-entries/inventory-entries-tab";
import { InventoryOutputsTab } from "./inventory-outputs/inventory-outputs-tab";
import { ProductsTab } from "./products/products-tab";

type CatalogTabKey =
  | "products"
  | "categories"
  | "inventory"
  | "entries"
  | "outputs";

export function CatalogTabs({
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
  const [activeTab, setActiveTab] = useState<CatalogTabKey>("products");

  return (
    <div>
      <Tabs
        aria-label="Catálogo"
        selectedKey={activeTab}
        onSelectionChange={(k) => setActiveTab(k as CatalogTabKey)}
      >
        <Tab key="products" title="Productos" />
        <Tab key="categories" title="Categorías" />
        {canViewInventoryItems ? <Tab key="inventory" title="Inventario" /> : null}
        {canEntry ? <Tab key="entries" title="Entradas" /> : null}
        {canOutput ? <Tab key="outputs" title="Salidas" /> : null}
      </Tabs>

      <div className="mt-4">
        {activeTab === "products" ? (
          <ProductsTab
            canCreate={canCreateItem}
            canDelete={canDeleteItem}
            canEdit={canEditItem}
          />
        ) : null}
        {activeTab === "categories" ? (
          <CategoriesTab
            canCreate={canCreateItem}
            canDelete={canDeleteItem}
            canEdit={canEditItem}
          />
        ) : null}
        {activeTab === "inventory" ? (
          <InventoryItemsTab
            canCreate={canCreateItem}
            canDelete={canDeleteItem}
            canEdit={canEditItem}
          />
        ) : null}
        {activeTab === "entries" ? (
          <InventoryEntriesTab
            canCreate={canEntry}
            canDelete={canEntry}
            canEdit={canEntry}
          />
        ) : null}
        {activeTab === "outputs" ? (
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
