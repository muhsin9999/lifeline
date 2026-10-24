import { Suspense } from "react";
import { MobileTabs, MobileTop } from "@/components/app/mobile-nav";
import { Sidebar } from "@/components/app/sidebar";
import { currentOrg } from "@/server/queries";

// Desktop: sidebar | page | rail. Phones: a top bar, the page, and a tab bar along the bottom.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-svh bg-paper md:flex">
      <Suspense fallback={<div className="hidden w-56 border-r border-line bg-sidebar md:block" />}>
        <OrgChrome />
      </Suspense>
      <div className="flex min-w-0 flex-1 pb-16 md:pb-0">{children}</div>
      <Suspense fallback={null}>
        <MobileTabs />
      </Suspense>
    </div>
  );
}

async function OrgChrome() {
  const org = await currentOrg();
  return (
    <>
      <Sidebar orgName={org.name} />
      <MobileTop orgName={org.name} />
    </>
  );
}
