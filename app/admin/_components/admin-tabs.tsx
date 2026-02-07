"use client";

import { useState } from "react";
import { Tabs, Tab } from "@heroui/tabs";

import { UsersTab } from "./users/users-tab";
import { EmployeesTab } from "./employees/employees-tab";
import { ClientsTab } from "./clients/clients-tab";
import { RolesTab } from "./roles/roles-tab";
import { PermissionsTab } from "./permissions/permissions-tab";
import { RolePermissionsTab } from "./role-permissions/role-permissions-tab";

type AdminTabKey =
  | "users"
  | "employees"
  | "clients"
  | "roles"
  | "permissions"
  | "rolePermissions";

export function AdminTabs() {
  const [activeTab, setActiveTab] = useState<AdminTabKey>("users");

  return (
    <div>
      <Tabs
        aria-label="Administración"
        selectedKey={activeTab}
        onSelectionChange={(k) => setActiveTab(k as AdminTabKey)}
      >
        <Tab key="users" title="Usuarios" />
        <Tab key="employees" title="Empleados" />
        <Tab key="clients" title="Clientes" />
        <Tab key="roles" title="Roles" />
        <Tab key="permissions" title="Permisos" />
        <Tab key="rolePermissions" title="Relaciones" />
      </Tabs>

      <div className="mt-4">
        {activeTab === "users" ? <UsersTab /> : null}
        {activeTab === "employees" ? <EmployeesTab /> : null}
        {activeTab === "clients" ? <ClientsTab /> : null}
        {activeTab === "roles" ? <RolesTab /> : null}
        {activeTab === "permissions" ? <PermissionsTab /> : null}
        {activeTab === "rolePermissions" ? <RolePermissionsTab /> : null}
      </div>
    </div>
  );
}
