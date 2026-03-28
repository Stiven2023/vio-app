"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
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

type SiigoJob = {
  id: string;
  jobType: string;
  status: string;
  bankId: string | null;
  requestedBy: string | null;
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export function SiigoJobsTab() {
  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<SiigoJob>("/api/siigo/sync-jobs", 20);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const retry = async (id: string) => {
    if (retryingId) return;

    try {
      setRetryingId(id);
      await apiJson(`/api/siigo/sync-jobs/${id}/retry`, {
        method: "POST",
      });
      toast.success("Retry executed");
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="flat" onPress={refresh}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Siigo jobs"
          headers={[
            "Type",
            "Status",
            "Bank",
            "Created",
            "Finished",
            "Result",
            "Actions",
          ]}
          rows={8}
        />
      ) : (
        <Table aria-label="Siigo sync jobs">
          <TableHeader>
            <TableColumn>Type</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>Bank</TableColumn>
            <TableColumn>Created</TableColumn>
            <TableColumn>Finished</TableColumn>
            <TableColumn>Result</TableColumn>
            <TableColumn>Actions</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No jobs" items={data?.items ?? []}>
            {(job) => (
              <TableRow key={job.id}>
                <TableCell>{job.jobType}</TableCell>
                <TableCell>{job.status}</TableCell>
                <TableCell>{job.bankId ?? "-"}</TableCell>
                <TableCell>
                  {job.createdAt ? new Date(job.createdAt).toLocaleString() : "-"}
                </TableCell>
                <TableCell>
                  {job.finishedAt ? new Date(job.finishedAt).toLocaleString() : "-"}
                </TableCell>
                <TableCell>
                  <div className="max-w-xs truncate text-xs text-default-600">
                    {job.result ? JSON.stringify(job.result) : "-"}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    color="primary"
                    isDisabled={
                      retryingId === job.id ||
                      (job.status !== "FAILED" && job.status !== "SUCCESS") ||
                      job.jobType !== "SYNC_CUSTOMERS"
                    }
                    size="sm"
                    variant="flat"
                    onPress={() => retry(job.id)}
                  >
                    {retryingId === job.id ? "Retrying..." : "Retry"}
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {data ? <Pager data={data} page={page} onChange={setPage} /> : null}
    </div>
  );
}
