"use client";

import { useEffect, useState } from "react";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";

type PaySlipItem = {
  id: string;
  period: string;
  status: string;
  netoAPagar: string;
  totalDevengado: string;
  totalDeducciones: string;
  pdfUrl: string | null;
  pagadoEn: string | null;
};

type PaySlipsResponse = {
  items: PaySlipItem[];
};

export function PaySlipsPanel() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PaySlipItem[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/hcm/colillas?page=1&pageSize=12");

        if (!response.ok) throw new Error("Unable to load pay slips.");

        const json = (await response.json()) as PaySlipsResponse;

        setItems(json.items ?? []);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <Card className="border border-default-200/50">
      <CardBody className="space-y-4 p-5">
        <div>
          <h3 className="text-lg font-semibold">Pay slips</h3>
          <p className="text-sm text-default-500">Latest payroll settlements generated for your account.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-default-100">
              <tr>
                <th className="px-3 py-2 text-left">Period</th>
                <th className="px-3 py-2 text-left">Net</th>
                <th className="px-3 py-2 text-left">Earnings</th>
                <th className="px-3 py-2 text-left">Deductions</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-default-200/60">
                  <td className="px-3 py-2">{item.period}</td>
                  <td className="px-3 py-2">{item.netoAPagar}</td>
                  <td className="px-3 py-2">{item.totalDevengado}</td>
                  <td className="px-3 py-2">{item.totalDeducciones}</td>
                  <td className="px-3 py-2"><Chip size="sm" variant="flat">{item.status}</Chip></td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td className="px-3 py-2 text-default-500" colSpan={5}>No pay slips found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
