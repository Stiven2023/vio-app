"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Tab, Tabs } from "@heroui/tabs";

type AccountingAccessLink = {
  title: string;
  href: string;
  description: string;
};

type AccountingGroup = {
  key: string;
  title: string;
  description: string;
  items: AccountingAccessLink[];
};

export function AccountingHubTabs({ groups }: { groups: AccountingGroup[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const allowedKeys = new Set(groups.map((group) => group.key));
  const requestedTab = String(searchParams.get("tab") ?? "").trim();
  const selectedTabKey =
    requestedTab && allowedKeys.has(requestedTab)
      ? requestedTab
      : (groups[0]?.key ?? "");

  const handleTabChange = (key: React.Key) => {
    const nextKey = String(key ?? "").trim();

    if (!nextKey || !allowedKeys.has(nextKey)) return;

    const params = new URLSearchParams(searchParams.toString());

    params.set("tab", nextKey);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs
      aria-label="Navegación contable"
      selectedKey={selectedTabKey}
      variant="underlined"
      onSelectionChange={handleTabChange}
    >
      {groups.map((group) => (
        <Tab key={group.key} title={group.title}>
          <div className="pt-4 space-y-3">
            <p className="text-sm text-default-500">{group.description}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => (
                <Card key={item.href} className="border border-default-200">
                  <CardBody>
                    <Link
                      className="rounded-medium border border-default-200 bg-content2/40 p-3 transition hover:border-primary hover:bg-primary/5"
                      href={item.href}
                    >
                      <div className="text-sm font-semibold">{item.title}</div>
                      <div className="mt-1 text-xs text-default-500">
                        {item.description}
                      </div>
                    </Link>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </Tab>
      ))}
    </Tabs>
  );
}