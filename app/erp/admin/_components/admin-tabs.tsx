"use client";

import type { ClientFormPrefill } from "./clients/client-modal.types";
import type { EmployeeFormPrefill } from "./employees/employee-modal.types";
import type { ConfectionistFormPrefill } from "@/app/erp/confectionists/_components/confectionist-modal.types";

import { Tabs, Tab } from "@heroui/tabs";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { UsersTab } from "./users/users-tab";
import { EmployeesTab } from "./employees/employees-tab";
import { ClientsTab } from "./clients/clients-tab";
import { RolesTab } from "./roles/roles-tab";
import { PermissionsTab } from "./permissions/permissions-tab";
import { RolePermissionsTab } from "./role-permissions/role-permissions-tab";

import { ConfectionistsTab } from "@/app/erp/confectionists/_components/confectionists-tab";

type AdminTabKey =
  | "users"
  | "employees"
  | "clients"
  | "confectionists"
  | "roles"
  | "permissions"
  | "rolePermissions";

export function AdminTabs() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTabKey>("users");
  const [clientPrefill, setClientPrefill] = useState<ClientFormPrefill | null>(
    null,
  );
  const [confectionistPrefill, setConfectionistPrefill] =
    useState<ConfectionistFormPrefill | null>(null);

  const openClientFromEmployee = (prefill: ClientFormPrefill) => {
    setClientPrefill(prefill);
    setActiveTab("clients");
  };

  const openEmployeeFromClient = (_prefill: EmployeeFormPrefill) => {
    router.push("/employee-register");
  };

  const openConfectionistFromClient = (prefill: ConfectionistFormPrefill) => {
    setConfectionistPrefill(prefill);
    setActiveTab("confectionists");
  };

  const openClientFromConfectionist = (prefill: ClientFormPrefill) => {
    setClientPrefill(prefill);
    setActiveTab("clients");
  };

  return (
    <div className="min-w-0 overflow-x-hidden">
      <Tabs
        aria-label="Administración"
        className="w-full"
        classNames={{
          panel: "overflow-visible p-0 h-auto max-h-none",
          tabContent: "overflow-visible",
        }}
        selectedKey={activeTab}
        onSelectionChange={(k) => setActiveTab(k as AdminTabKey)}
      >
        <Tab key="users" title="Usuarios" />
        <Tab key="employees" title="Empleados" />
        <Tab key="clients" title="Clientes" />
        <Tab key="confectionists" title="Confeccionistas" />
        <Tab key="roles" title="Roles" />
        <Tab key="permissions" title="Permisos" />
        <Tab key="rolePermissions" title="Relaciones" />
      </Tabs>

      <div className="mt-4 min-w-0 overflow-x-hidden">
        {activeTab === "users" ? <UsersTab /> : null}
        {activeTab === "employees" ? (
          <EmployeesTab onRequestCreateClient={openClientFromEmployee} />
        ) : null}
        {activeTab === "clients" ? (
          <ClientsTab
            prefillCreate={clientPrefill}
            onPrefillConsumed={() => setClientPrefill(null)}
            onRequestCreateConfectionist={openConfectionistFromClient}
            onRequestCreateEmployee={openEmployeeFromClient}
          />
        ) : null}
        {activeTab === "confectionists" ? (
          <ConfectionistsTab
            canCreate={true}
            canDelete={true}
            canEdit={true}
            prefillCreate={confectionistPrefill}
            onPrefillConsumed={() => setConfectionistPrefill(null)}
            onRequestCreateClient={openClientFromConfectionist}
          />
        ) : null}
        {activeTab === "roles" ? <RolesTab /> : null}
        {activeTab === "permissions" ? <PermissionsTab /> : null}
        {activeTab === "rolePermissions" ? <RolePermissionsTab /> : null}
      </div>
    </div>
  );
}
