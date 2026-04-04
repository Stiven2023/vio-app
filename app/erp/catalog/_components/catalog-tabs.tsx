"use client";

import { Tabs, Tab } from "@heroui/tabs";
import { useState } from "react";

import { CategoriesTab } from "./categories/categories-tab";
import { ProductManagementTabs } from "./product-management-tabs";

type CatalogTabKey = "products" | "categories";

export function CatalogTabs({
  canCreateItem,
  canEditItem,
  canDeleteItem,
}: {
  canCreateItem: boolean;
  canEditItem: boolean;
  canDeleteItem: boolean;
}) {
  const [activeTab, setActiveTab] = useState<CatalogTabKey>("products");

  return (
    <div className="min-w-0 overflow-x-hidden">
      <Tabs
        aria-label="Catálogo"
        className="w-full"
        classNames={{
          panel: "overflow-visible p-0",
        }}
        selectedKey={activeTab}
        onSelectionChange={(k) => setActiveTab(k as CatalogTabKey)}
      >
        <Tab key="products" title="Productos y Adiciones" />
        <Tab key="categories" title="Categorías" />
      </Tabs>

      <div className="mt-4 min-w-0 overflow-x-hidden">
        {activeTab === "products" ? (
          <ProductManagementTabs
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
      </div>
    </div>
  );
}
