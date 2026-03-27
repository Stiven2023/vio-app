"use client";

import type { PurchaseHintView } from "@/src/types/design-overview";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Card, CardBody } from "@heroui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { FiRefreshCw } from "react-icons/fi";

import { apiJson, getErrorMessage } from "../_lib/api";

export function MoldingPurchaseNeedsTab() {
  const [items, setItems] = useState<PurchaseHintView[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiJson<{ items: PurchaseHintView[] }>(
        "/api/molding/purchase-hints?limit=50",
      );

      setItems(res.items);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-default-600">
            Resumen read-only por diseño para Compras, derivado de moldería +
            pedido. No genera insumos automáticos.
          </p>
          <Chip color="warning" size="sm" variant="flat">
            Pendiente de parametrización de insumos
          </Chip>
        </div>
        <Button
          isIconOnly
          isDisabled={loading}
          size="sm"
          variant="light"
          onPress={load}
        >
          <FiRefreshCw />
        </Button>
      </div>

      <Table removeWrapper aria-label="Purchase hints per design">
        <TableHeader>
          <TableColumn>Pedido / diseño</TableColumn>
          <TableColumn>Base</TableColumn>
          <TableColumn>Reglas de compra</TableColumn>
          <TableColumn>Estado</TableColumn>
        </TableHeader>
        <TableBody emptyContent="No hay diseños con moldería aplicada para generar resumen de compras.">
          {items.map((row) => (
            <TableRow key={row.orderItemId}>
              <TableCell>
                <div className="space-y-1">
                  <div className="font-medium">{row.orderCode}</div>
                  <div className="text-sm text-default-600">{row.designName}</div>
                  {row.multiTeamDisabled ? (
                    <Chip color="default" size="sm" variant="bordered">
                      Multi-equipo deshabilitado
                    </Chip>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1 text-sm">
                  <div>Cantidad: {row.qtyTotal}</div>
                  <div>Técnica: {row.productionTechnique ?? "—"}</div>
                  <div>Tela: {row.fabric ?? "—"}</div>
                  <div>Color: {row.color ?? "—"}</div>
                  <div>
                    Moldería: {row.moldingTemplateCode ?? "—"}
                    {row.moldingTemplateVersion ? ` v${row.moldingTemplateVersion}` : ""}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-2">
                  {row.requirements.length === 0 ? (
                    <div className="text-sm text-default-500">Sin reglas derivadas.</div>
                  ) : (
                    row.requirements.slice(0, 6).map((requirement) => (
                      <Card key={requirement.key} shadow="none">
                        <CardBody className="px-0 py-1">
                          <div className="text-sm font-medium">{requirement.label}</div>
                          <div className="text-sm text-default-600">
                            {requirement.value ?? "Por definir"}
                          </div>
                          {requirement.details ? (
                            <div className="text-xs text-default-500">
                              {requirement.details}
                            </div>
                          ) : null}
                        </CardBody>
                      </Card>
                    ))
                  )}
                  {row.requirements.length > 6 ? (
                    <div className="text-xs text-default-500">
                      +{row.requirements.length - 6} reglas adicionales
                    </div>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-2">
                  <Chip color="warning" size="sm" variant="flat">
                    Solo resumen
                  </Chip>
                  <div className="text-xs text-default-500">
                    Compras usa estas reglas como guía hasta parametrizar insumos.
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
