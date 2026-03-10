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
import NextLink from "next/link";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BsChevronDown } from "react-icons/bs";

import { ThemeSwitch } from "@/components/theme-switch";
import {
  buildNavbarOtherItems,
  buildNavbarSections,
  otherMenuIcon as OtherMenuIcon,
} from "@/components/navbar.data";
import { useSessionStore } from "@/store/session";
import { isOperarioRole } from "@/src/utils/role-status";

const permissionsStorageKey = "viomar.permissions.v1";

export const Navbar = () => {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/" || pathname === "/login" || pathname === "/erp/login") {
    return null;
  }

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
  const [canSeePayments, setCanSeePayments] = useState(false);

  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const effectiveRole = role ?? null;
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
    setCanSeePayments(Boolean(permissions?.VER_PAGO || permissions?.CREAR_PAGO));
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
      `/api/auth/permissions?names=VER_CLIENTE,VER_INVENTARIO,VER_PEDIDO,VER_PROVEEDOR,CREAR_ORDEN_COMPRA,VER_CONFECCIONISTA,VER_EMPAQUE,VER_HISTORIAL_ESTADO,VER_PAGO,CREAR_PAGO`,
      { credentials: "include" },
    )
      .then(async (r) => {
        if (!r.ok) {
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
              VER_PAGO: false,
              CREAR_PAGO: false,
            },
          };
        }

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

  const toErpHref = (href: string) => {
    if (!href.startsWith("/")) return href;
    if (href === "/" || href.startsWith("/erp") || href.startsWith("/mes") || href.startsWith("/crm")) {
      return href;
    }

    return `/erp${href}`;
  };

  const normalizedPathname = pathname.startsWith("/erp/")
    ? pathname.replace(/^\/erp/, "") || "/"
    : pathname;

  const isActive = (href: string) =>
    pathname === toErpHref(href) ||
    pathname.startsWith(`${toErpHref(href)}/`) ||
    normalizedPathname === href ||
    normalizedPathname.startsWith(`${href}/`);

  const sections = useMemo(
    () =>
      buildNavbarSections({
        isAuthenticated,
        canSeeCatalog,
        canSeeClients,
        canSeeOrders,
        canSeePayments,
        canSeePurchaseOrders,
        canSeeStatusHistory,
        canSeeSuppliers,
      }),
    [
    canSeeCatalog,
    canSeeClients,
    canSeeOrders,
    canSeePayments,
    canSeePurchaseOrders,
    canSeeStatusHistory,
    canSeeSuppliers,
    isAuthenticated,
    ],
  );

  const otherItems = useMemo(
    () => buildNavbarOtherItems({ isAuthenticated, isAdmin }),
    [isAdmin, isAuthenticated],
  );

  const visibleSections = sections.filter((section) => section.visible);

  const handleUserMenuAction = async (actionKey: string) => {
    if (actionKey === "notifications") {
      router.push("/erp/notifications");

      return;
    }

    if (actionKey === "options") {
      router.push("/erp/options");

      return;
    }

    if (actionKey === "logout") {
      await logout();
      router.push("/login");
    }
  };

  return (
    <HeroUINavbar
      maxWidth="full"
      position="sticky"
      className="overflow-x-hidden"
      classNames={{
        wrapper: "px-2 sm:px-4 xl:px-6 gap-1 sm:gap-3 xl:gap-4",
      }}
    >
      <NavbarContent className="flex flex-none items-center" justify="start">
        <NavbarItem>
          <NextLink className="text-sm font-semibold text-default-700" href="/erp/dashboard">
            ERP
          </NextLink>
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className="hidden xl:flex basis-2/4" justify="center">
        {!isAuthenticated ? null : operarioOnly ? (
          <ul className="flex gap-2 items-center">
            <NavbarItem>
              <Button as={NextLink} href="/erp/dashboard" size="sm" variant={isActive("/dashboard") ? "solid" : "light"}>
                Dashboard
              </Button>
            </NavbarItem>
            <NavbarItem>
              <Button as={NextLink} href="/erp/envios" size="sm" variant={isActive("/envios") ? "solid" : "light"}>
                Envíos
              </Button>
            </NavbarItem>
          </ul>
        ) : (
          <ul className="flex items-center gap-1">
            {visibleSections.map((section) => (
              section.key === "dashboard" ? (
                <NavbarItem key={section.key}>
                  <Button
                    as={NextLink}
                    href="/erp/dashboard"
                    startContent={<section.icon className="text-sm" />}
                    size="sm"
                    variant={section.items.some((item) => isActive(item.href)) ? "solid" : "light"}
                  >
                    {section.label}
                  </Button>
                </NavbarItem>
              ) : section.items.length === 1 ? (
                <NavbarItem key={section.key}>
                  <Button
                    as={NextLink}
                    href={toErpHref(section.items[0].href)}
                    startContent={<section.icon className="text-sm" />}
                    size="sm"
                    variant={isActive(section.items[0].href) ? "solid" : "light"}
                  >
                    {section.label}
                  </Button>
                </NavbarItem>
              ) : (
                <NavbarItem key={section.key}>
                  <Dropdown onOpenChange={(open) => setOpenGroup(open ? section.key : null)}>
                    <DropdownTrigger>
                      <Button
                        startContent={<section.icon className="text-sm" />}
                        endContent={<BsChevronDown className="text-xs" />}
                        size="sm"
                        variant={
                          section.items.some((item) => isActive(item.href) && !item.href.startsWith("/en-construccion"))
                            ? "solid"
                            : "light"
                        }
                        className={clsx(openGroup === section.key ? "bg-default-200" : "")}
                      >
                        {section.label}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label={section.label}>
                      {section.items.map((item) => (
                        <DropdownItem key={`${section.key}-${item.href}`} as={NextLink} href={toErpHref(item.href)}>
                          {item.name}
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                </NavbarItem>
              )
            ))}

            <NavbarItem key="others">
              <Dropdown onOpenChange={(open) => setOpenGroup(open ? "others" : null)}>
                <DropdownTrigger>
                  <Button
                    startContent={<OtherMenuIcon className="text-sm" />}
                    endContent={<BsChevronDown className="text-xs" />}
                    size="sm"
                    variant={otherItems.some((item) => isActive(item.href)) ? "solid" : "light"}
                    className={clsx(openGroup === "others" ? "bg-default-200" : "")}
                  >
                    Otros
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Otros">
                  {otherItems.map((item) => (
                    <DropdownItem key={`others-${item.href}`} as={NextLink} href={toErpHref(item.href)}>
                      {item.name}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
            </NavbarItem>
          </ul>
        )}
      </NavbarContent>

      <NavbarContent className="hidden xl:flex basis-1/4 pr-2 lg:pr-4" justify="end">
        <NavbarItem className="hidden xl:flex gap-2 items-center">
          <ThemeSwitch />
        </NavbarItem>

        {isAuthenticated ? (
          <NavbarItem className="hidden xl:flex items-center">
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Button className="h-auto px-2" variant="light">
                  <div className="flex items-center gap-1">
                    <Avatar name={user?.name ?? "VIOMAR"} size="sm" src={user?.avatarUrl ?? undefined} />
                    <BsChevronDown className="text-xs text-default-500" />
                  </div>
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Menu de usuario" onAction={(key) => void handleUserMenuAction(String(key))}>
                <DropdownItem key="user-header" isReadOnly className="opacity-100 cursor-default" textValue="Usuario actual">
                  <div className="flex items-center gap-3 py-1">
                    <Avatar name={user?.name ?? "VIOMAR"} size="sm" src={user?.avatarUrl ?? undefined} />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium leading-tight">{user?.name ?? "Usuario"}</span>
                      <span className="text-xs text-default-500 leading-tight">{role ?? "SIN_ROL"}</span>
                    </div>
                  </div>
                </DropdownItem>
                <DropdownItem key="notifications">Notificaciones</DropdownItem>
                <DropdownItem key="options">Opciones</DropdownItem>
                <DropdownItem key="logout" className="text-danger" color="danger">
                  Cierre de sesion
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </NavbarItem>
        ) : null}
      </NavbarContent>

      <NavbarContent className="xl:hidden ml-auto flex-none gap-1 sm:gap-2 min-w-0" justify="end">
        {isAuthenticated ? (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={user?.name ?? "VIOMAR"} size="sm" src={user?.avatarUrl ?? undefined} />
            <div className="text-xs font-medium truncate max-w-[120px] hidden sm:block">{user?.name ?? "Usuario"}</div>
          </div>
        ) : null}
        <ThemeSwitch />
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu className="overflow-x-hidden max-w-[100vw]">
        <div className="mt-2 mb-3 px-3 flex w-full max-w-full flex-col gap-2 max-h-[calc(100vh-6rem)] overflow-y-auto overflow-x-hidden">
          {!isAuthenticated ? null : operarioOnly ? (
            <>
              <NavbarMenuItem>
                <Link color="foreground" href="/erp/dashboard" size="lg">
                  Dashboard
                </Link>
              </NavbarMenuItem>
              <NavbarMenuItem>
                <Link color="foreground" href="/erp/envios" size="lg">
                  Envíos
                </Link>
              </NavbarMenuItem>
              <NavbarMenuItem>
                <Link color="foreground" href="/erp/options" size="lg">
                  Opciones
                </Link>
              </NavbarMenuItem>
            </>
          ) : (
            <>
              {visibleSections.map((section) => (
                <div key={`mobile-${section.key}`} className="w-full min-w-0 max-w-full rounded-medium border border-default-200 p-2">
                  <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-default-500 flex items-center gap-2">
                    <section.icon className="text-sm" />
                    {section.label}
                  </div>
                  <div className="flex flex-col">
                    {section.items.map((item) => (
                      <NavbarMenuItem key={`mobile-${section.key}-${item.href}`} className="w-full min-w-0">
                        <Link
                          className="block w-full min-w-0 whitespace-normal break-words"
                          color="foreground"
                          href={toErpHref(item.href)}
                          size="md"
                        >
                          {item.name}
                        </Link>
                      </NavbarMenuItem>
                    ))}
                  </div>
                </div>
              ))}

              <div className="w-full min-w-0 max-w-full rounded-medium border border-default-200 p-2">
                <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-default-500 flex items-center gap-2">
                  <OtherMenuIcon className="text-sm" />
                  Otros
                </div>
                <div className="flex flex-col">
                  {otherItems.map((item) => (
                    <NavbarMenuItem key={`mobile-others-${item.href}`} className="w-full min-w-0">
                      <Link
                        className="block w-full min-w-0 whitespace-normal break-words"
                        color="foreground"
                        href={toErpHref(item.href)}
                        size="md"
                      >
                        {item.name}
                      </Link>
                    </NavbarMenuItem>
                  ))}
                </div>
              </div>
            </>
          )}

          {isAuthenticated ? (
            <>
              <NavbarMenuItem>
                <Link color="foreground" href="/erp/notifications" size="md">
                  Notificaciones
                </Link>
              </NavbarMenuItem>
              <NavbarMenuItem key="logout-mobile">
                <Button
                  className="w-full"
                  color="danger"
                  variant="flat"
                  onPress={async () => {
                    await logout();
                    router.push("/login");
                  }}
                >
                  Cierre de sesion
                </Button>
              </NavbarMenuItem>
            </>
          ) : null}
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
