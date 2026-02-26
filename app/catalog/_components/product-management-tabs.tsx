"use client";

import type { Category } from "../_lib/types";

import { useEffect, useState } from "react";
import { Tab, Tabs } from "@heroui/tabs";

import { apiJson } from "../_lib/api";
import { ProductsTab } from "./products/products-tab";
import { AdditionsTab } from "./additions/additions-tab";

type ProductManagementTab = "products" | "additions";
type CatalogType = "NACIONAL" | "INTERNACIONAL";

export function ProductManagementTabs({
  canCreate,
  canEdit,
  canDelete,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [activeTab, setActiveTab] = useState<ProductManagementTab>("products");
  const [activeCatalog, setActiveCatalog] = useState<CatalogType>("NACIONAL");
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    apiJson<{ items: Category[] }>(`/api/categories?page=1&pageSize=400`)
      .then((r) => setCategories(r.items ?? []))
      .catch(() => setCategories([]));
  }, []);

  return (
    <div className="space-y-3">
      <Tabs
        aria-label="Tipo de catálogo"
        selectedKey={activeCatalog}
        onSelectionChange={(key) =>
          setActiveCatalog(key as unknown as CatalogType)
        }
      >
        <Tab key="NACIONAL" title="Catálogo Nacional" />
        <Tab key="INTERNACIONAL" title="Catálogo Internacional" />
      </Tabs>

      {/* Product/Addition Management Tabs */}
      <Tabs
        aria-label="Gestión de productos"
        selectedKey={activeTab}
        onSelectionChange={(key) =>
          setActiveTab(key as unknown as ProductManagementTab)
        }
      >
        <Tab key="products" title="Productos" />
        <Tab key="additions" title="Adiciones" />
      </Tabs>

      {/* Content */}
      {activeTab === "products" ? (
        <ProductsTab
          activeCatalog={activeCatalog}
          categories={categories}
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      ) : (
        <AdditionsTab
          activeCatalog={activeCatalog}
          categories={categories}
        />
      )}
    </div>
  );
}
