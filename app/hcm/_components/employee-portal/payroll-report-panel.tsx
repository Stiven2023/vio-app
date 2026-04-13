"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@heroui/card";

type PayrollItem = {
  totalDevengado: string;
  totalDeducciones: string;
  netoAPagar: string;
};

type PayrollResponse = {
  items: PayrollItem[];
};

function toNumber(value: string) {
  const next = Number(value);

  return Number.isFinite(next) ? next : 0;
}

export function PayrollReportPanel() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PayrollItem[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/hcm/colillas?page=1&pageSize=24");

        if (!response.ok) throw new Error("Unable to load payroll report.");

        const json = (await response.json()) as PayrollResponse;

        setItems(json.items ?? []);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.earnings += toNumber(item.totalDevengado);
        acc.deductions += toNumber(item.totalDeducciones);
        acc.net += toNumber(item.netoAPagar);

        return acc;
      },
      { earnings: 0, deductions: 0, net: 0 },
    );
  }, [items]);

  return (
    <Card className="border border-default-200/50">
      <CardBody className="space-y-4 p-5">
        <div>
          <h3 className="text-lg font-semibold">Payroll report</h3>
          <p className="text-sm text-default-500">Summary computed from your latest payroll slips.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-medium border border-default-200/60 p-3">
            <p className="text-xs uppercase text-default-400">Earnings</p>
            <p className="text-lg font-semibold">{totals.earnings.toFixed(2)}</p>
          </div>
          <div className="rounded-medium border border-default-200/60 p-3">
            <p className="text-xs uppercase text-default-400">Deductions</p>
            <p className="text-lg font-semibold">{totals.deductions.toFixed(2)}</p>
          </div>
          <div className="rounded-medium border border-default-200/60 p-3">
            <p className="text-xs uppercase text-default-400">Net payable</p>
            <p className="text-lg font-semibold">{totals.net.toFixed(2)}</p>
          </div>
        </div>

        {!loading && items.length === 0 ? (
          <p className="text-sm text-default-500">No payroll records available yet.</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
