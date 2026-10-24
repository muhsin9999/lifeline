import { Suspense } from "react";
import { connection } from "next/server";
import { StudioClient } from "@/components/dashboard/studio-client";
import { currentOrg } from "@/server/queries";
import { getStudioData } from "@/server/studio-data";

export const metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <main className="h-[calc(100svh-7.5rem)] min-w-0 flex-1 md:h-svh">
      <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading reports…</div>}>
        <Reports />
      </Suspense>
    </main>
  );
}

async function Reports() {
  await connection();
  const org = await currentOrg();
  const data = await getStudioData(org.id);
  return <StudioClient data={data} />;
}
