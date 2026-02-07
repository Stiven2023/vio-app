"use client";

import { useState } from "react";
import { Tabs, Tab } from "@heroui/tabs";

import { CategoriesTab } from "./categories/categories-tab";
import { ProductsTab } from "./products/products-tab";

type CatalogTabKey = "products" | "categories";

export function CatalogTabs({
  canCreate,
  canEdit,
  canDelete,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
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
      </Tabs>

      <div className="mt-4">
        {activeTab === "products" ? (
          <ProductsTab
            canCreate={canCreate}
            canDelete={canDelete}
            canEdit={canEdit}
          />
        ) : null}
        {activeTab === "categories" ? (
          <CategoriesTab
            canCreate={canCreate}
            canDelete={canDelete}
            canEdit={canEdit}
          />
        ) : null}
      </div>
    </div>
  );
}
