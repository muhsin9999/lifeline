import type { Metadata } from "next";
import { ArchitectureExplorer } from "@/components/architecture/explorer";

export const metadata: Metadata = {
  title: "Architecture",
  description: "How Lifeline is built: the parts, how a rescue travels through them, what keeps the AI safe, and why each choice was made.",
};

export default function ArchitecturePage() {
  return <ArchitectureExplorer />;
}
