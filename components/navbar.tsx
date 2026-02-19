"use client";

import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
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
  BsBoxSeam,
  BsClipboardData,
  BsClockHistory,
  BsChevronDown,
  BsGear,
  BsPeople,
  BsPerson,
  BsTruck,
  BsWindowStack,
} from "react-icons/bs";

import { ThemeSwitch } from "@/components/theme-switch";
import { ViomarLogo } from "@/components/viomar-logo";
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
  "LIDER_DE_PROCESOS",
  "ASESOR",
  "COMPRAS",
  "DISEÑADOR",
  "OPERARIO_EMPAQUE",
  "OPERARIO_INVENTARIO",
  "OPERARIO_INTEGRACION",
  "OPERARIO_CORTE_LASER",
  "OPERARIO_CORTE_MANUAL",
  "OPERARIO_IMPRESION",
  "OPERARIO_ESTAMPACION",
  "OPERARIO_MONTAJE",
  "OPERARIO_SUBLIMACION",
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
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1" href="/">
            <ViomarLogo className="h-7" />
          </NextLink>
        </NavbarBrand>
        <ul className="hidden lg:flex gap-2 justify-start ml-2">
          {isAuthenticated ? (
            <NavbarItem key="nav-dashboard">
              <Tooltip content="Dashboard">
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
                <Tooltip content="Pedidos">
                  <DropdownTrigger>
                    <Button
                      isIconOnly
                      variant="light"
                      className={clsx(
                        iconBase,
                        isActive("/orders") || isActive("/status-history")
                          ? activeClass
                          : idleClass,
                        openGroup === "orders" ? activeClass : null,
                      )}
                    >
                      <BsClipboardData />
                    </Button>
                  </DropdownTrigger>
                </Tooltip>
                <DropdownMenu aria-label="Pedidos">
                  {canSeeOrders ? (
                    <DropdownItem
                      key="orders"
                      as={NextLink}
                      href="/orders"
                      startContent={<BsClipboardData />}
                    >
                      Pedidos
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
          (canSeeCatalog || canSeePurchaseOrders || canSeeSuppliers) ? (
            <NavbarItem key="nav-inventory">
              <Dropdown
                onOpenChange={(open) => setOpenGroup(open ? "inventory" : null)}
              >
                <Tooltip content="Inventario">
                  <DropdownTrigger>
                    <Button
                      isIconOnly
                      variant="light"
                      className={clsx(
                        iconBase,
                        isActive("/catalog") ||
                          isActive("/purchase-orders") ||
                          isActive("/suppliers")
                          ? activeClass
                          : idleClass,
                        openGroup === "inventory" ? activeClass : null,
                      )}
                    >
                      <BsBoxSeam />
                    </Button>
                  </DropdownTrigger>
                </Tooltip>
                <DropdownMenu aria-label="Inventario">
                  {canSeeCatalog ? (
                    <DropdownItem
                      key="catalog"
                      as={NextLink}
                      href="/catalog"
                      startContent={<BsBoxSeam />}
                    >
                      Catálogo
                    </DropdownItem>
                  ) : null}
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
                </DropdownMenu>
              </Dropdown>
            </NavbarItem>
          ) : null}

          {!operarioOnly && isAuthenticated && canSeeClients ? (
            <NavbarItem key="/clients">
              <Tooltip content="Clientes">
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

          {!operarioOnly && isAuthenticated && canSeeConfectionists ? (
            <NavbarItem key="/confectionists">
              <Tooltip content="Confeccionistas">
                <NextLink
                  className={clsx(
                    iconBase,
                    isActive("/confectionists") ? activeClass : idleClass,
                  )}
                  href="/confectionists"
                >
                  <BsPerson />
                </NextLink>
              </Tooltip>
            </NavbarItem>
          ) : null}

          {!operarioOnly && isAuthenticated && canSeePackers ? (
            <NavbarItem key="/packers">
              <Tooltip content="Empaque">
                <NextLink
                  className={clsx(
                    iconBase,
                    isActive("/packers") ? activeClass : idleClass,
                  )}
                  href="/packers"
                >
                  <BsTruck />
                </NextLink>
              </Tooltip>
            </NavbarItem>
          ) : null}

          {!operarioOnly && isAdmin ? (
            <NavbarItem key="/admin">
              <Tooltip content="Administración">
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
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2 items-center">
          {canOverrideRole ? (
            <Dropdown>
              <DropdownTrigger>
                <Button size="sm" variant="flat">
                  Rol: {roleOverride || user?.role || "Sin rol"}
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
              <Avatar
                name={user?.name ?? "VIOMAR"}
                size="sm"
                src="/STICKER%20VIOMAR.png"
              />
              <div className="leading-tight">
                <div className="text-sm font-medium">
                  {user?.name ?? "Usuario"}
                </div>
                <div className="text-xs text-default-500">
                  {user?.role ?? "Sin rol"}
                </div>
              </div>
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
