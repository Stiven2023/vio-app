"use client";

import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarItem,
  NavbarMenuItem,
} from "@heroui/navbar";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { Link } from "@heroui/link";
import { Tooltip } from "@heroui/tooltip";
import NextLink from "next/link";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BsCart4,
  BsBoxSeam,
  BsClipboardData,
  BsClockHistory,
  BsChevronDown,
  BsGear,
  BsPeople,
  BsPerson,
  BsReceipt,
  BsTag,
  BsTruck,
  BsWindowStack,
} from "react-icons/bs";

import { ThemeSwitch } from "@/components/theme-switch";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useSessionStore } from "@/store/session";
import { isOperarioRole } from "@/src/utils/role-status";

const publicMenuItems = [{ name: "Login", href: "/login" }];
const baseMenuItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Inicio", href: "/" },
];
const permissionsStorageKey = "viomar.permissions.v1";
const roleOptions = [
  "ADMINISTRADOR",
  "LIDER_JURIDICA",
  "RH",
  "AUXILIAR_RH",
  "LIDER_FINANCIERA",
  "AUXILIAR_CONTABLE",
  "TESORERIA_Y_CARTERA",
  "LIDER_COMERCIAL",
  "ASESOR",
  "LIDER_SUMINISTROS",
  "COMPRA_NACIONAL",
  "COMPRA_INTERNACIONAL",
  "LIDER_DISEÑO",
  "DISEÑADOR",
  "LIDER_OPERACIONAL",
  "PROGRAMACION",
  "OPERARIO_DESPACHO",
  "OPERARIO_BODEGA",
  "OPERARIO_FLOTER",
  "OPERARIO_INTEGRACION_CALIDAD",
  "OPERARIO_CORTE_LASER",
  "OPERARIO_CORTE_MANUAL",
  "OPERARIO_MONTAJE",
  "OPERARIO_SUBLIMACION",
  "MENSAJERO",
  "CONFECCIONISTA",
  "EMPAQUE",
];

export const Navbar = () => {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const logout = useSessionStore((s) => s.clearSession);
  const role = useSessionStore((s) => s.user?.role);
  const isAdmin = role === "ADMINISTRADOR";

  const [canSeeClients, setCanSeeClients] = useState(false);
  const [canSeeCatalog, setCanSeeCatalog] = useState(false);
  const [canSeeOrders, setCanSeeOrders] = useState(false);
  const [canSeeSuppliers, setCanSeeSuppliers] = useState(false);
  const [canSeePurchaseOrders, setCanSeePurchaseOrders] = useState(false);
  const [canSeeConfectionists, setCanSeeConfectionists] = useState(false);
  const [canSeePackers, setCanSeePackers] = useState(false);
  const [canSeeStatusHistory, setCanSeeStatusHistory] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [roleOverride, setRoleOverride] = useState("");
  const pathname = usePathname();
  const canOverrideRole =
    isAuthenticated && isAdmin && process.env.NODE_ENV !== "production";
  const effectiveRole = canOverrideRole && roleOverride ? roleOverride : role ?? null;
  const displayedRole = roleOverride || user?.role || "Sin rol";
  const operarioOnly = isOperarioRole(effectiveRole);

  const applyPermissions = (permissions?: Record<string, boolean>) => {
    setCanSeeClients(Boolean(permissions?.VER_CLIENTE));
    setCanSeeCatalog(Boolean(permissions?.VER_INVENTARIO));
    setCanSeeOrders(Boolean(permissions?.VER_PEDIDO));
    setCanSeeSuppliers(Boolean(permissions?.VER_PROVEEDOR));
    setCanSeePurchaseOrders(Boolean(permissions?.CREAR_ORDEN_COMPRA));
    setCanSeeConfectionists(Boolean(permissions?.VER_CONFECCIONISTA));
    setCanSeePackers(Boolean(permissions?.VER_EMPAQUE));
    setCanSeeStatusHistory(Boolean(permissions?.VER_HISTORIAL_ESTADO));
  };

  const readCachedPermissions = () => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(permissionsStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, boolean> | null;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  };

  const writeCachedPermissions = (permissions?: Record<string, boolean>) => {
    if (typeof window === "undefined") return;
    if (!permissions) return;
    try {
      sessionStorage.setItem(permissionsStorageKey, JSON.stringify(permissions));
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    let active = true;

    if (!isAuthenticated) {
      applyPermissions();
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(permissionsStorageKey);
      }

      return;
    }

    const cached = readCachedPermissions();
    if (cached) {
      applyPermissions(cached);
    }

    fetch(
      `/api/auth/permissions?names=VER_CLIENTE,VER_INVENTARIO,VER_PEDIDO,VER_PROVEEDOR,CREAR_ORDEN_COMPRA,VER_CONFECCIONISTA,VER_EMPAQUE,VER_HISTORIAL_ESTADO`,
      {
        credentials: "include",
      },
    )
      .then(async (r) => {
        if (!r.ok)
          return {
            permissions: {
              VER_CLIENTE: false,
              VER_INVENTARIO: false,
              VER_PEDIDO: false,
              VER_PROVEEDOR: false,
              CREAR_ORDEN_COMPRA: false,
              VER_CONFECCIONISTA: false,
              VER_EMPAQUE: false,
              VER_HISTORIAL_ESTADO: false,
            },
          };

        return (await r.json()) as { permissions?: Record<string, boolean> };
      })
      .then((data) => {
        if (!active) return;
        applyPermissions(data?.permissions);
        writeCachedPermissions(data?.permissions);
      })
      .catch(() => {
        if (!active) return;
        applyPermissions();
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    let active = true;

    if (!canOverrideRole) {
      setRoleOverride("");
      return;
    }

    fetch("/api/auth/role-override", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return { roleOverride: "" };
        return (await res.json()) as { roleOverride?: string };
      })
      .then((data) => {
        if (!active) return;
        setRoleOverride(String(data?.roleOverride ?? ""));
      })
      .catch(() => {
        if (!active) return;
        setRoleOverride("");
      });

    return () => {
      active = false;
    };
  }, [canOverrideRole]);

  const handleRoleOverride = async (roleValue: string) => {
    if (!canOverrideRole) return;

    const trimmed = roleValue.trim();

    if (!trimmed) {
      const res = await fetch("/api/auth/role-override", {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        setRoleOverride("");
        router.refresh();
      }

      return;
    }

    const res = await fetch("/api/auth/role-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role: trimmed }),
    });

    if (res.ok) {
      setRoleOverride(trimmed);
      router.refresh();
    }
  };

  const menuItems = useMemo(() => {
    if (!isAuthenticated) {
      return publicMenuItems;
    }

    if (operarioOnly) {
      return [{ name: "Dashboard", href: "/dashboard" }];
    }

    const extra: { name: string; href: string }[] = [];

    if (isAuthenticated && canSeeClients) {
      extra.push({ name: "Clientes", href: "/clients" });
    }
    if (isAuthenticated && canSeeOrders) {
      extra.push({ name: "Pedidos", href: "/orders" });
      extra.push({ name: "Cotizaciones", href: "/quotations" });
      extra.push({ name: "Prefacturas", href: "/prefacturas" });
      extra.push({ name: "Contabilidad", href: "/contabilidad" });
      extra.push({ name: "Aprobación inicial", href: "/aprobacion-inicial" });
      extra.push({ name: "Programación", href: "/programacion" });
    }
    if (isAuthenticated && canSeeCatalog) {
      extra.push({ name: "Inventario", href: "/inventory" });
    }
    if (isAuthenticated && canSeeCatalog) {
      extra.push({ name: "Catálogo", href: "/catalog" });
    }
    if (isAuthenticated && canSeePurchaseOrders) {
      extra.push({ name: "Órdenes de compra", href: "/purchase-orders" });
    }
    if (isAuthenticated && canSeeSuppliers) {
      extra.push({ name: "Proveedores", href: "/suppliers" });
    }
    if (isAuthenticated && canSeeConfectionists) {
      extra.push({ name: "Confeccionistas", href: "/confectionists" });
    }
    if (isAuthenticated && canSeePackers) {
      extra.push({ name: "Empaque", href: "/packers" });
    }
    if (isAuthenticated && canSeeStatusHistory) {
      extra.push({ name: "Historial", href: "/status-history" });
    }
    if (isAuthenticated) {
      extra.push({ name: "Notificaciones", href: "/notifications" });
    }
    if (isAdmin) {
      extra.push({ name: "Administración", href: "/admin" });
    }

    return [...baseMenuItems, ...extra];
  }, [
    canSeeCatalog,
    canSeeClients,
    canSeeConfectionists,
    canSeePackers,
    canSeeOrders,
    canSeePurchaseOrders,
    canSeeStatusHistory,
    canSeeSuppliers,
    isAdmin,
    isAuthenticated,
    operarioOnly,
  ]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const iconBase =
    "flex h-9 w-9 items-center justify-center rounded-medium border border-transparent";
  const activeClass = "text-success border-success/40 bg-success-50";
  const idleClass = "text-default-600 hover:text-foreground hover:bg-default-100";

  return (
    <HeroUINavbar maxWidth="xl" position="sticky">
      <NavbarContent className="hidden sm:flex basis-1/4 pl-2" justify="start">
        {isAuthenticated ? (
          <NavbarItem>
            <span className="rounded-medium border border-default-200 px-3 py-1 text-xs font-semibold text-default-700">
              {displayedRole}
            </span>
          </NavbarItem>
        ) : null}
      </NavbarContent>

      <NavbarContent className="hidden lg:flex basis-2/4" justify="center">
        <ul className="flex gap-2 justify-center">
          {isAuthenticated ? (
            <NavbarItem key="nav-dashboard">
              <Tooltip content="Dashboard" placement="bottom">
                <NextLink
                  className={clsx(
                    iconBase,
                    isActive("/dashboard") ? activeClass : idleClass,
                  )}
                  href="/dashboard"
                >
                  <BsWindowStack />
                </NextLink>
              </Tooltip>
            </NavbarItem>
          ) : null}

          {!operarioOnly && isAuthenticated && (canSeeOrders || canSeeStatusHistory) ? (
            <NavbarItem key="nav-orders">
              <Dropdown onOpenChange={(open) => setOpenGroup(open ? "orders" : null)}>
                <DropdownTrigger>
                  <Button
                    isIconOnly
                    variant="light"
                    title="Pedidos"
                    className={clsx(
                      iconBase,
                      isActive("/orders") ||
                        isActive("/prefacturas") ||
                        isActive("/contabilidad") ||
                        isActive("/aprobacion-inicial") ||
                        isActive("/programacion") ||
                        isActive("/status-history")
                        ? activeClass
                        : idleClass,
                      openGroup === "orders" ? activeClass : null,
                    )}
                  >
                    <BsCart4 />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Pedidos">
                  {canSeeOrders ? (
                    <DropdownItem
                      key="orders"
                      as={NextLink}
                      href="/orders"
                      startContent={<BsCart4 />}
                    >
                      Pedidos
                    </DropdownItem>
                  ) : null}
                  {canSeeOrders ? (
                    <DropdownItem
                      key="quotations"
                      as={NextLink}
                      href="/quotations"
                      startContent={<BsClipboardData />}
                    >
                      Cotizaciones
                    </DropdownItem>
                  ) : null}
                  {canSeeOrders ? (
                    <DropdownItem
                      key="prefacturas"
                      as={NextLink}
                      href="/prefacturas"
                      startContent={<BsReceipt />}
                    >
                      Prefacturas
                    </DropdownItem>
                  ) : null}
                  {canSeeOrders ? (
                    <DropdownItem
                      key="contabilidad"
                      as={NextLink}
                      href="/contabilidad"
                      startContent={<BsReceipt />}
                    >
                      Contabilidad
                    </DropdownItem>
                  ) : null}
                  {canSeeOrders ? (
                    <DropdownItem
                      key="aprobacion-inicial"
                      as={NextLink}
                      href="/aprobacion-inicial"
                      startContent={<BsClipboardData />}
                    >
                      Aprobación inicial
                    </DropdownItem>
                  ) : null}
                  {canSeeOrders ? (
                    <DropdownItem
                      key="programacion"
                      as={NextLink}
                      href="/programacion"
                      startContent={<BsWindowStack />}
                    >
                      Programación
                    </DropdownItem>
                  ) : null}
                  {canSeeStatusHistory ? (
                    <DropdownItem
                      key="history"
                      as={NextLink}
                      href="/status-history"
                      startContent={<BsClockHistory />}
                    >
                      Historial
                    </DropdownItem>
                  ) : null}
                </DropdownMenu>
              </Dropdown>
            </NavbarItem>
          ) : null}

          {!operarioOnly &&
          isAuthenticated &&
          (canSeePurchaseOrders ||
            canSeeSuppliers ||
            canSeeConfectionists ||
            canSeePackers) ? (
            <NavbarItem key="nav-supply">
              <Dropdown
                onOpenChange={(open) => setOpenGroup(open ? "supply" : null)}
              >
                <DropdownTrigger>
                  <Button
                    isIconOnly
                    variant="light"
                    className={clsx(
                      iconBase,
                      isActive("/purchase-orders") ||
                        isActive("/suppliers") ||
                        isActive("/confectionists") ||
                        isActive("/packers")
                        ? activeClass
                        : idleClass,
                      openGroup === "supply" ? activeClass : null,
                    )}
                  >
                    <BsBoxSeam />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Suministros">
                  {canSeePurchaseOrders ? (
                    <DropdownItem
                      key="purchase-orders"
                      as={NextLink}
                      href="/purchase-orders"
                      startContent={<BsBoxSeam />}
                    >
                      Órdenes de compra
                    </DropdownItem>
                  ) : null}
                  {canSeeSuppliers ? (
                    <DropdownItem
                      key="suppliers"
                      as={NextLink}
                      href="/suppliers"
                      startContent={<BsTruck />}
                    >
                      Proveedores
                    </DropdownItem>
                  ) : null}
                  {canSeeConfectionists ? (
                    <DropdownItem
                      key="confectionists"
                      as={NextLink}
                      href="/confectionists"
                      startContent={<BsPerson />}
                    >
                      Confeccionistas
                    </DropdownItem>
                  ) : null}
                  {canSeePackers ? (
                    <DropdownItem
                      key="packers"
                      as={NextLink}
                      href="/packers"
                      startContent={<BsTruck />}
                    >
                      Empaque
                    </DropdownItem>
                  ) : null}
                </DropdownMenu>
              </Dropdown>
            </NavbarItem>
          ) : null}

          {!operarioOnly && isAuthenticated && canSeeClients ? (
            <NavbarItem key="/clients">
              <Tooltip content="Clientes" placement="bottom">
                <NextLink
                  className={clsx(
                    iconBase,
                    isActive("/clients") ? activeClass : idleClass,
                  )}
                  href="/clients"
                >
                  <BsPeople />
                </NextLink>
              </Tooltip>
            </NavbarItem>
          ) : null}

          {!operarioOnly && isAuthenticated && canSeeCatalog ? (
            <NavbarItem key="/inventory">
              <Tooltip content="Inventario" placement="bottom">
                <NextLink
                  className={clsx(
                    iconBase,
                    isActive("/inventory") ? activeClass : idleClass,
                  )}
                  href="/inventory"
                >
                  <BsClipboardData />
                </NextLink>
              </Tooltip>
            </NavbarItem>
          ) : null}

          {!operarioOnly && isAuthenticated && canSeeCatalog ? (
            <NavbarItem key="/catalog">
              <Tooltip content="Catálogo" placement="bottom">
                <NextLink
                  className={clsx(
                    iconBase,
                    isActive("/catalog") ? activeClass : idleClass,
                  )}
                  href="/catalog"
                >
                  <BsTag />
                </NextLink>
              </Tooltip>
            </NavbarItem>
          ) : null}

          {!operarioOnly && isAdmin ? (
            <NavbarItem key="/admin">
              <Tooltip content="Administración" placement="bottom">
                <NextLink
                  className={clsx(
                    iconBase,
                    isActive("/admin") ? activeClass : idleClass,
                  )}
                  href="/admin"
                >
                  <BsGear />
                </NextLink>
              </Tooltip>
            </NavbarItem>
          ) : null}
        </ul>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/4 pr-2 lg:pr-4"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2 items-center">
          {canOverrideRole ? (
            <Dropdown>
              <DropdownTrigger>
                <Button size="sm" variant="flat">
                  Rol: {displayedRole}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Cambiar rol"
                onAction={(key) => handleRoleOverride(String(key))}
                selectedKeys={roleOverride ? [roleOverride] : []}
                selectionMode="single"
                items={[{ key: "" }, ...roleOptions.map((role) => ({ key: role }))]}
              >
                {(item) => (
                  <DropdownItem key={item.key}>
                    {item.key || "Sin override"}
                  </DropdownItem>
                )}
              </DropdownMenu>
            </Dropdown>
          ) : null}
          <NotificationBell enabled={isAuthenticated} />
          <ThemeSwitch />
        </NavbarItem>

        {isAuthenticated ? (
          <NavbarItem className="hidden sm:flex gap-3 items-center">
            <div className="flex items-center gap-2">
              <Avatar name={user?.name ?? "VIOMAR"} size="sm" />
              <div className="text-sm font-medium">{user?.name ?? "Usuario"}</div>
            </div>

            <Button
              size="sm"
              variant="flat"
              onPress={async () => {
                await logout();
                router.push("/login");
              }}
            >
              Logout
            </Button>
          </NavbarItem>
        ) : null}
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <ThemeSwitch />
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu>
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {menuItems.map((item) => (
            <NavbarMenuItem key={item.href}>
              <Link color="foreground" href={item.href} size="lg">
                {item.name}
              </Link>
            </NavbarMenuItem>
          ))}
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
