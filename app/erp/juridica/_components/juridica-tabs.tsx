"use client";

import { Tabs, Tab } from "@heroui/tabs";

import { ClientsTab } from "@/app/erp/admin/_components/clients/clients-tab";
import { EmployeesTab } from "@/app/erp/admin/_components/employees/employees-tab";
import { ConfectionistsTab } from "@/app/erp/confectionists/_components/confectionists-tab";
import { PackersTab } from "@/app/erp/packers/_components/packers-tab";
import { SuppliersTab } from "@/app/erp/suppliers/_components/suppliers-tab";

type JuridicaTabKey = "clientes" | "empleados" | "terceros";

function toTabKey(value?: string): JuridicaTabKey {
  if (value === "empleados" || value === "terceros") return value;

  return "clientes";
}

export function JuridicaTabs({
  canViewClient,
  canViewEmployee,
  canViewSupplier,
  canViewConfectionist,
  canViewPacker,
  canChangeClientLegalStatus,
  canChangeEmployeeLegalStatus,
  canChangeSupplierLegalStatus,
  canChangeConfectionistLegalStatus,
  canChangePackerLegalStatus,
  initialTab,
}: {
  canViewClient: boolean;
  canViewEmployee: boolean;
  canViewSupplier: boolean;
  canViewConfectionist: boolean;
  canViewPacker: boolean;
  canChangeClientLegalStatus: boolean;
  canChangeEmployeeLegalStatus: boolean;
  canChangeSupplierLegalStatus: boolean;
  canChangeConfectionistLegalStatus: boolean;
  canChangePackerLegalStatus: boolean;
  initialTab?: string;
}) {
  const selected = toTabKey(initialTab);

  const hasAnyThirdPartyTab =
    canViewSupplier || canViewConfectionist || canViewPacker;

  return (
    <Tabs
      aria-label="Secciones de juridica"
      defaultSelectedKey={selected}
      variant="underlined"
    >
      {canViewClient ? (
        <Tab key="clientes" title="Clientes">
          <div className="mt-3">
            <ClientsTab
              legalOnlyMode
              canChangeLegalStatus={canChangeClientLegalStatus}
              canCreate={false}
              canDelete={false}
              canEdit={false}
            />
          </div>
        </Tab>
      ) : null}

      {canViewEmployee ? (
        <Tab key="empleados" title="Empleados">
          <div className="mt-3">
            <EmployeesTab
              legalOnlyMode
              canChangeLegalStatus={canChangeEmployeeLegalStatus}
              canCreate={false}
              canDelete={false}
              canEdit={false}
            />
          </div>
        </Tab>
      ) : null}

      {hasAnyThirdPartyTab ? (
        <Tab key="terceros" title="Terceros">
          <div className="mt-3">
            <Tabs aria-label="Tipos de terceros" variant="bordered">
              {canViewSupplier ? (
                <Tab key="proveedores" title="Proveedores">
                  <div className="mt-3">
                    <SuppliersTab
                      legalOnlyMode
                      canChangeLegalStatus={canChangeSupplierLegalStatus}
                      canCreate={false}
                      canDelete={false}
                      canEdit={false}
                    />
                  </div>
                </Tab>
              ) : null}

              {canViewConfectionist ? (
                <Tab key="confeccionistas" title="Confeccionistas">
                  <div className="mt-3">
                    <ConfectionistsTab
                      legalOnlyMode
                      canChangeLegalStatus={canChangeConfectionistLegalStatus}
                      canCreate={false}
                      canDelete={false}
                      canEdit={false}
                    />
                  </div>
                </Tab>
              ) : null}

              {canViewPacker ? (
                <Tab key="empaque" title="Empaque">
                  <div className="mt-3">
                    <PackersTab
                      legalOnlyMode
                      canChangeLegalStatus={canChangePackerLegalStatus}
                      canCreate={false}
                      canDelete={false}
                      canEdit={false}
                    />
                  </div>
                </Tab>
              ) : null}
            </Tabs>
          </div>
        </Tab>
      ) : null}
    </Tabs>
  );
}
