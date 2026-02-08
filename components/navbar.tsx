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
  BsGear,
  BsPeople,
  BsPerson,
  BsTruck,
} from "react-icons/bs";

import { ThemeSwitch } from "@/components/theme-switch";
import { ViomarLogo } from "@/components/viomar-logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useSessionStore } from "@/store/session";

const routes = [
  { name: "Inicio", href: "/" },
  { name: "Registro Usuario", href: "/register" },
  { name: "Registro Empleado", href: "/employee-register" },
  { name: "Login", href: "/login" },
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
  const [canSeeConfectionists, setCanSeeConfectionists] = useState(false);
  const [canSeeStatusHistory, setCanSeeStatusHistory] = useState(false);
  const [canSeeNotifications, setCanSeeNotifications] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;

    if (!isAuthenticated) {
      setCanSeeClients(false);
      setCanSeeCatalog(false);
      setCanSeeOrders(false);
      setCanSeeSuppliers(false);
      setCanSeeConfectionists(false);
      setCanSeeStatusHistory(false);
      setCanSeeNotifications(false);

      return;
    }

    fetch(
      `/api/auth/permissions?names=VER_CLIENTE,VER_INVENTARIO,VER_PEDIDO,VER_PROVEEDOR,VER_CONFECCIONISTA,VER_HISTORIAL_ESTADO,VER_NOTIFICACION`,
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
              VER_CONFECCIONISTA: false,
              VER_HISTORIAL_ESTADO: false,
              VER_NOTIFICACION: false,
            },
          };

        return (await r.json()) as { permissions?: Record<string, boolean> };
      })
      .then((data) => {
        if (!active) return;
        setCanSeeClients(Boolean(data?.permissions?.VER_CLIENTE));
        setCanSeeCatalog(Boolean(data?.permissions?.VER_INVENTARIO));
        setCanSeeOrders(Boolean(data?.permissions?.VER_PEDIDO));
        setCanSeeSuppliers(Boolean(data?.permissions?.VER_PROVEEDOR));
        setCanSeeConfectionists(Boolean(data?.permissions?.VER_CONFECCIONISTA));
        setCanSeeStatusHistory(Boolean(data?.permissions?.VER_HISTORIAL_ESTADO));
        setCanSeeNotifications(Boolean(data?.permissions?.VER_NOTIFICACION));
      })
      .catch(() => {
        if (!active) return;
        setCanSeeClients(false);
        setCanSeeCatalog(false);
        setCanSeeOrders(false);
        setCanSeeSuppliers(false);
        setCanSeeConfectionists(false);
        setCanSeeStatusHistory(false);
        setCanSeeNotifications(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const menuItems = useMemo(() => {
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
    if (isAuthenticated && canSeeSuppliers) {
      extra.push({ name: "Proveedores", href: "/suppliers" });
    }
    if (isAuthenticated && canSeeConfectionists) {
      extra.push({ name: "Confeccionistas", href: "/confectionists" });
    }
    if (isAuthenticated && canSeeStatusHistory) {
      extra.push({ name: "Historial", href: "/status-history" });
    }
    if (isAuthenticated && canSeeNotifications) {
      extra.push({ name: "Notificaciones", href: "/notifications" });
    }
    if (isAdmin) {
      extra.push({ name: "Administración", href: "/admin" });
    }

    return [...routes, ...extra];
  }, [
    canSeeCatalog,
    canSeeClients,
    canSeeConfectionists,
    canSeeOrders,
    canSeeStatusHistory,
    canSeeSuppliers,
    canSeeNotifications,
    isAdmin,
    isAuthenticated,
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
          {isAuthenticated && (canSeeOrders || canSeeStatusHistory) ? (
            <NavbarItem key="nav-orders">
              <Dropdown
                onOpenChange={(open) => setOpenGroup(open ? "orders" : null)}
              >
                <DropdownTrigger>
                  <Tooltip content="Pedidos">
                    <Button
                      isIconOnly
                      variant="light"
                      className={clsx(
                        iconBase,
                        isActive("/orders") ||
                          isActive("/status-history") ||
                          openGroup === "orders"
                          ? activeClass
                          : idleClass,
                      )}
                    >
                      <BsClipboardData />
                    </Button>
                  </Tooltip>
                </DropdownTrigger>
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

          {isAuthenticated && (canSeeCatalog || canSeeSuppliers) ? (
            <NavbarItem key="nav-inventory">
              <Dropdown
                onOpenChange={(open) => setOpenGroup(open ? "inventory" : null)}
              >
                <DropdownTrigger>
                  <Tooltip content="Inventario">
                    <Button
                      isIconOnly
                      variant="light"
                      className={clsx(
                        iconBase,
                        isActive("/catalog") ||
                          isActive("/suppliers") ||
                          openGroup === "inventory"
                          ? activeClass
                          : idleClass,
                      )}
                    >
                      <BsBoxSeam />
                    </Button>
                  </Tooltip>
                </DropdownTrigger>
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

          {isAuthenticated && canSeeClients ? (
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

          {isAuthenticated && canSeeConfectionists ? (
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

          {isAdmin ? (
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
          <NotificationBell enabled={isAuthenticated && canSeeNotifications} />
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
