export const dynamic = "force-dynamic";

import { PerDiemTab } from "./_components/per-diem-tab";

export default function Page() {
  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <PerDiemTab />
    </div>
  );
}
