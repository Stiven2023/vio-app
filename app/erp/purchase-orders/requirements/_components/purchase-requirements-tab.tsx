"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import NextLink from "next/link";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";

import { Pager } from "@/app/erp/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/erp/catalog/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";

type RequirementLine = {
  id: string;
  category: string;
  description: string;
  qtyPlanned: string;
  unit: string | null;
  qtyOrdered: string;
  qtyReceived: string;
  coverageStatus: string;
  inventoryItemId: string | null;
};

type RequirementRow = {
  id: string;
  orderId: string;
  orderItemId: string;
  status: string;
  hintsSnapshot: {
    designName?: string;
    orderCode?: string;
    requirements?: Array<{
      label?: string;
      value?: string | null;
      details?: string | null;
      status?: string;
    }>;
  } | null;
  createdAt: string | null;
  lines: RequirementLine[];
};

export function PurchaseRequirementsTab() {
  const [orderId, setOrderId] = useState("");
  const [orderItemId, setOrderItemId] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<RequirementRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();

    if (orderId.trim()) params.set("orderId", orderId.trim());
    if (orderItemId.trim()) params.set("orderItemId", orderItemId.trim());
    if (status.trim()) params.set("status", status.trim().toUpperCase());

    const query = params.toString();

    return `/api/purchase-requirements${query ? `?${query}` : ""}`;
  }, [orderId, orderItemId, status]);

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<RequirementRow>(endpoint, 12);

  const openDetail = async (row: RequirementRow) => {
    try {
      const detail = await apiJson<RequirementRow>(
        `/api/purchase-requirements/${row.id}`,
      );

      setSelected(detail);
      setDetailOpen(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const updateLine = (
    lineId: string,
    patch: Partial<Pick<RequirementLine, "description" | "qtyPlanned" | "unit" | "coverageStatus">>,
  ) => {
    setSelected((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        lines: prev.lines.map((line) =>
          line.id === lineId ? { ...line, ...patch } : line,
        ),
      };
    });
  };

  const saveDetail = async (approve = false) => {
    if (!selected || saving) return;

    try {
      setSaving(true);

      await apiJson(`/api/purchase-requirements/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: approve ? "APROBADO" : selected.status,
          lines: selected.lines.map((line) => ({
            id: line.id,
            description: line.description,
            qtyPlanned: line.qtyPlanned,
            unit: line.unit,
            coverageStatus: line.coverageStatus,
          })),
        }),
      });

      toast.success(approve ? "Requirement approved" : "Requirement updated");
      setDetailOpen(false);
      setSelected(null);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        <Input
          label="Order ID"
          placeholder="Filter by order"
          value={orderId}
          onValueChange={setOrderId}
        />
        <Input
          label="Order item ID"
          placeholder="Filter by design"
          value={orderItemId}
          onValueChange={setOrderItemId}
        />
        <Input
          label="Status"
          placeholder="BORRADOR / APROBADO"
          value={status}
          onValueChange={setStatus}
        />
        <div className="flex items-end justify-end">
          <Button variant="flat" onPress={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Purchase requirements"
          headers={["Order", "Design", "Status", "Created", "Actions"]}
          rows={8}
        />
      ) : (
        <Table aria-label="Purchase requirements list">
          <TableHeader>
            <TableColumn>Order</TableColumn>
            <TableColumn>Design</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>Created</TableColumn>
            <TableColumn>Actions</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No requirements" items={data?.items ?? []}>
            {(row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="text-sm">
                    {row.hintsSnapshot?.orderCode ?? row.orderId}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {row.hintsSnapshot?.designName ?? row.orderItemId}
                  </div>
                </TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>
                  {row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="flat" onPress={() => openDetail(row)}>
                    Detail
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {data ? <Pager data={data} page={page} onChange={setPage} /> : null}

      <Modal
        disableAnimation
        isOpen={detailOpen}
        size="5xl"
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelected(null);
        }}
      >
        <ModalContent>
          <ModalHeader>
            Requirement detail - {selected?.hintsSnapshot?.designName ?? selected?.orderItemId ?? ""}
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div className="rounded-xl border border-default-200 bg-default-50 p-4">
              <p className="text-sm font-semibold">Hints snapshot</p>
              <div className="mt-2 space-y-1 text-xs text-default-600">
                {(selected?.hintsSnapshot?.requirements ?? []).length === 0 ? (
                  <p>No hints available.</p>
                ) : (
                  (selected?.hintsSnapshot?.requirements ?? []).map((hint, index) => (
                    <p key={`${hint.label ?? "hint"}-${index}`}>
                      <strong>{hint.label ?? "Requirement"}:</strong> {hint.value ?? "-"}
                      {hint.details ? ` · ${hint.details}` : ""}
                    </p>
                  ))
                )}
              </div>
            </div>

            <Table aria-label="Requirement lines">
              <TableHeader>
                <TableColumn>Description</TableColumn>
                <TableColumn>Qty planned</TableColumn>
                <TableColumn>Unit</TableColumn>
                <TableColumn>Coverage</TableColumn>
                <TableColumn>Qty ordered</TableColumn>
                <TableColumn>Qty received</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No lines" items={selected?.lines ?? []}>
                {(line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <Input
                        value={line.description}
                        onValueChange={(value) =>
                          updateLine(line.id, { description: value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={String(line.qtyPlanned ?? "")}
                        onValueChange={(value) =>
                          updateLine(line.id, { qtyPlanned: value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={line.unit ?? ""}
                        onValueChange={(value) => updateLine(line.id, { unit: value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={line.coverageStatus}
                        onValueChange={(value) =>
                          updateLine(line.id, { coverageStatus: value.toUpperCase() })
                        }
                      />
                    </TableCell>
                    <TableCell>{line.qtyOrdered}</TableCell>
                    <TableCell>{line.qtyReceived}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ModalBody>
          <ModalFooter>
            <Button as={NextLink} href={`/erp/purchase-orders/new?requirementId=${encodeURIComponent(selected?.id ?? "")}`} variant="flat">
              Create PO (stub)
            </Button>
            <Button isDisabled={saving || !selected} variant="flat" onPress={() => saveDetail(false)}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button color="primary" isDisabled={saving || !selected} onPress={() => saveDetail(true)}>
              {saving ? "Saving..." : "Approve requirement"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
