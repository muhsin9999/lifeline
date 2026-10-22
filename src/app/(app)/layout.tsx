import { Suspense } from "react";
import { Sidebar } from "@/components/app/sidebar";
import { currentOrg } from "@/server/queries";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh bg-paper">
      <Suspense fallback={<div className="hidden w-56 border-r border-line bg-sidebar md:block" />}>
        <OrgSidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1">{children}</div>
    </div>
  );
}

async function OrgSidebar() {
  const org = await currentOrg();
  return <Sidebar orgName={org.name} />;
}
