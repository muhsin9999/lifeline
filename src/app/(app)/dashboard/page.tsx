import { redirect } from "next/navigation";

// The page was renamed Reports; old links still land there.
export default function OldDashboard() {
  redirect("/reports");
}
