import { redirect } from "next/navigation";

// The landing page comes later; for now the app opens on the rescues.
export default function Home() {
  redirect("/rescues");
}
