"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";

type CertificationItem = {
  key: string;
  label: string;
  url: string | null;
};

type CertificationsResponse = {
  certifications: CertificationItem[];
};

export function TrainingPanel() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CertificationItem[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/hcm/certifications", { credentials: "include" });

        if (!response.ok) throw new Error("Unable to load certifications.");

        const json = (await response.json()) as CertificationsResponse;

        setItems(json.certifications ?? []);
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
          <h3 className="text-lg font-semibold">Training and certifications</h3>
          <p className="text-sm text-default-500">Download available certifications and compliance documents.</p>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-medium border border-default-200/60 p-3">
              <p className="text-sm font-medium">{item.label}</p>
              {item.url ? (
                <Button as="a" href={item.url} size="sm" target="_blank" variant="flat">Open</Button>
              ) : (
                <span className="text-xs text-default-500">Pending</span>
              )}
            </div>
          ))}
          {!loading && items.length === 0 ? (
            <p className="text-sm text-default-500">No certification artifacts available.</p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
