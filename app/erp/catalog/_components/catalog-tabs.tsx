"use client";

import { Tabs, Tab } from "@heroui/tabs";

import { CategoriesTab } from "./categories/categories-tab";
import { ProductManagementTabs } from "./product-management-tabs";
import { useState } from "react";

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
    <div>
      <Tabs
        aria-label="Catálogo"
        selectedKey={activeTab}
        onSelectionChange={(k) => setActiveTab(k as CatalogTabKey)}
      >
        <Tab key="products" title="Productos y Adiciones" />
        <Tab key="categories" title="Categorías" />
      </Tabs>

      <div className="mt-4">
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
