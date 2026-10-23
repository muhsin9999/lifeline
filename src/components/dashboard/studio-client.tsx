"use client";

import dynamic from "next/dynamic";
import type { StudioData } from "@/server/studio-data";

// AG Studio renders in the browser only (server rendering isn't documented for it).
const Studio = dynamic(() => import("./studio"), { ssr: false, loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading the dashboard…</div> });

export function StudioClient({ data }: { data: StudioData }) {
  return <Studio data={data} />;
}
