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
import { Link } from "@heroui/link";
import { link as linkStyles } from "@heroui/theme";
import NextLink from "next/link";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { ViomarLogo } from "@/components/viomar-logo";
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

  useEffect(() => {
    let active = true;

    if (!isAuthenticated) {
      setCanSeeClients(false);
      setCanSeeCatalog(false);

      return;
    }

    fetch(`/api/auth/permissions?names=VER_CLIENTE,VER_INVENTARIO`, {
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok)
          return { permissions: { VER_CLIENTE: false, VER_INVENTARIO: false } };

        return (await r.json()) as { permissions?: Record<string, boolean> };
      })
      .then((data) => {
        if (!active) return;
        setCanSeeClients(Boolean(data?.permissions?.VER_CLIENTE));
        setCanSeeCatalog(Boolean(data?.permissions?.VER_INVENTARIO));
      })
      .catch(() => {
        if (!active) return;
        setCanSeeClients(false);
        setCanSeeCatalog(false);
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
    if (isAuthenticated && canSeeCatalog) {
      extra.push({ name: "Catálogo", href: "/catalog" });
    }
    if (isAdmin) {
      extra.push({ name: "Administración", href: "/admin" });
    }

    return [...routes, ...extra];
  }, [canSeeCatalog, canSeeClients, isAdmin, isAuthenticated]);

  return (
    <HeroUINavbar maxWidth="xl" position="sticky">
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1" href="/">
            <ViomarLogo className="h-7" />
          </NextLink>
        </NavbarBrand>
        <ul className="hidden lg:flex gap-4 justify-start ml-2">
          {siteConfig.navItems.map((item) => (
            <NavbarItem key={item.href}>
              <NextLink
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "data-[active=true]:text-primary data-[active=true]:font-medium",
                )}
                color="foreground"
                href={item.href}
              >
                {item.label}
              </NextLink>
            </NavbarItem>
          ))}

          {isAuthenticated && canSeeClients ? (
            <NavbarItem key="/clients">
              <NextLink
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "data-[active=true]:text-primary data-[active=true]:font-medium",
                )}
                href="/clients"
              >
                Clientes
              </NextLink>
            </NavbarItem>
          ) : null}

          {isAuthenticated && canSeeCatalog ? (
            <NavbarItem key="/catalog">
              <NextLink
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "data-[active=true]:text-primary data-[active=true]:font-medium",
                )}
                href="/catalog"
              >
                Catálogo
              </NextLink>
            </NavbarItem>
          ) : null}

          {isAdmin ? (
            <NavbarItem key="/admin">
              <NextLink
                className={clsx(
                  linkStyles({ color: "foreground" }),
                  "data-[active=true]:text-primary data-[active=true]:font-medium",
                )}
                href="/admin"
              >
                Administración
              </NextLink>
            </NavbarItem>
          ) : null}
        </ul>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2 items-center">
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
