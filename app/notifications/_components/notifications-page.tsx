"use client";

import { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";

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

export function NotificationsPage() {
  const role = useSessionStore((s) => s.user?.role ?? "");
  const isAdmin = role === "ADMINISTRADOR";

  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [roleFilter, setRoleFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / 10));
  }, [total]);

  useEffect(() => {
    setRoleFilter(role ?? "");
  }, [role]);

  useEffect(() => {
    const sp = new URLSearchParams();

    sp.set("page", String(page));
    sp.set("pageSize", "10");

    if (isAdmin && roleFilter) sp.set("role", roleFilter);
    if (startDate) sp.set("startDate", startDate);
    if (endDate) sp.set("endDate", endDate);

    setLoading(true);
    fetch(`/api/notifications?${sp.toString()}`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((json) => {
        setItems(Array.isArray(json.items) ? json.items : []);
        setTotal(Number(json.total ?? 0));
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, roleFilter, startDate, endDate, isAdmin]);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      credentials: "include",
    });

    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  };

  const markAllRead = async () => {
    await fetch(`/api/notifications`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notificaciones</h1>
          <p className="text-sm text-default-500">
            Filtra por fecha y rol para ver los eventos recientes.
          </p>
        </div>
        <Button as={NextLink} href="/dashboard" variant="flat">
          Volver
        </Button>
      </div>

      <Card>
        <CardBody>
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
              isDisabled={!isAdmin}
              label="Rol"
              selectedKeys={roleFilter ? [roleFilter] : []}
              onSelectionChange={(keys) => {
                const first = Array.from(keys)[0];
                setRoleFilter(first ? String(first) : "");
                setPage(1);
              }}
            >
              {roleOptions.map((r) => (
                <SelectItem key={r}>{r}</SelectItem>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

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
                  <Button as={NextLink} href={n.href} size="sm" variant="flat">
                    Ver
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
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
    </div>
  );
}
