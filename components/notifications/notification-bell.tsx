"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { BsBell } from "react-icons/bs";

import { useSessionStore } from "@/store/session";

type NotificationRow = {
  id: string;
  title: string | null;
  message: string;
  role: string | null;
  href: string | null;
  isRead: boolean | null;
  createdAt: string | null;
};

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

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);

  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export function NotificationBell({ enabled }: { enabled: boolean }) {
  const role = useSessionStore((s) => s.user?.role ?? "");
  const isAdmin = role === "ADMINISTRADOR";

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const [roleFilter, setRoleFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!enabled) return;
    setRoleFilter(role ?? "");
  }, [enabled, role]);

  const canFilterRole = isAdmin;

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / 10));
  }, [total]);

  const loadUnreadCount = async () => {
    if (!enabled) return;

    try {
      const res = await fetch(`/api/notifications?page=1&pageSize=1`, {
        credentials: "include",
      });

      if (!res.ok) return;

      const json = await res.json();
      setUnreadCount(Number(json.unreadCount ?? 0));
    } catch {
      // ignore
    }
  };

  const loadNotifications = async () => {
    if (!enabled) return;

    const sp = new URLSearchParams();

    sp.set("page", String(page));
    sp.set("pageSize", "10");

    if (canFilterRole && roleFilter) sp.set("role", roleFilter);
    if (startDate) sp.set("startDate", startDate);
    if (endDate) sp.set("endDate", endDate);

    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?${sp.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error(await res.text());

      const json = await res.json();

      setItems(Array.isArray(json.items) ? json.items : []);
      setTotal(Number(json.total ?? 0));
      setUnreadCount(Number(json.unreadCount ?? 0));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    loadUnreadCount();

    const t = setInterval(loadUnreadCount, 30_000);

    return () => clearInterval(t);
  }, [enabled]);

  useEffect(() => {
    if (!open) return;
    loadNotifications();
  }, [open, page, roleFilter, startDate, endDate]);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      credentials: "include",
    });

    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    loadUnreadCount();
  };

  const markAllRead = async () => {
    await fetch(`/api/notifications`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    loadUnreadCount();
  };

  if (!enabled) return null;

  return (
    <>
      <Button
        isIconOnly
        variant="light"
        onPress={() => setOpen(true)}
        aria-label="Notificaciones"
        className="relative"
      >
        <BsBell />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-[18px] rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>

      <Modal isOpen={open} size="3xl" onOpenChange={setOpen}>
        <ModalContent>
          <ModalHeader>Notificaciones</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Input
                label="Desde"
                type="date"
                value={startDate}
                onValueChange={setStartDate}
              />
              <Input
                label="Hasta"
                type="date"
                value={endDate}
                onValueChange={setEndDate}
              />
              <Select
                isDisabled={!canFilterRole}
                label="Rol"
                selectedKeys={roleFilter ? [roleFilter] : []}
                onSelectionChange={(keys) => {
                  const first = Array.from(keys)[0];
                  setRoleFilter(first ? String(first) : "");
                }}
              >
                {roleOptions.map((r) => (
                  <SelectItem key={r}>{r}</SelectItem>
                ))}
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-default-500">
                Pagina {page} / {totalPages}
              </div>
              <Button size="sm" variant="flat" onPress={markAllRead}>
                Marcar todo como leido
              </Button>
            </div>

            <div className="space-y-2">
              {loading ? <div>Cargando...</div> : null}
              {!loading && items.length === 0 ? (
                <div className="text-sm text-default-500">Sin notificaciones</div>
              ) : null}
              {items.map((n) => (
                <div
                  key={n.id}
                  className={
                    "rounded-medium border p-3 " +
                    (n.isRead ? "border-default-200" : "border-success-300")
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        {n.title ?? "Notificacion"}
                      </div>
                      <div className="text-sm text-default-600">{n.message}</div>
                      <div className="mt-1 text-xs text-default-500">
                        {formatDate(n.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {n.role ? (
                        <Chip size="sm" variant="flat">
                          {n.role}
                        </Chip>
                      ) : null}
                      {!n.isRead ? (
                        <Button size="sm" variant="flat" onPress={() => markRead(n.id)}>
                          Marcar leido
                        </Button>
                      ) : null}
                      {n.href ? (
                        <Button
                          as="a"
                          href={n.href}
                          size="sm"
                          target="_self"
                          variant="flat"
                        >
                          Ver
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex w-full justify-between">
              <div className="flex gap-2">
                <Button as="a" href="/notifications" size="sm" variant="flat">
                  Ver todas
                </Button>
                <Button
                  isDisabled={page <= 1}
                  size="sm"
                  variant="flat"
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  isDisabled={page >= totalPages}
                  size="sm"
                  variant="flat"
                  onPress={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
              <Button variant="flat" onPress={() => setOpen(false)}>
                Cerrar
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
