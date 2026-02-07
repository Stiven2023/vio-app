"use client";

import type { Paginated } from "../../_lib/types";

import { Pagination } from "@heroui/pagination";

export function Pager({
  data,
  page,
  onChange,
}: {
  data: Paginated<unknown>;
  page: number;
  onChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="flex justify-end">
      <Pagination
        color="primary"
        page={page}
        total={totalPages}
        onChange={onChange}
      />
    </div>
  );
}
