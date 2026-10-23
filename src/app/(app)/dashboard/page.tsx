import { Suspense } from "react";
import { connection } from "next/server";
import { StudioClient } from "@/components/dashboard/studio-client";
import { currentOrg } from "@/server/queries";
import { getStudioData } from "@/server/studio-data";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <main className="h-svh min-w-0 flex-1">
      <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading the dashboard…</div>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  await connection();
  const org = await currentOrg();
  const data = await getStudioData(org.id);
  return <StudioClient data={data} />;
}
