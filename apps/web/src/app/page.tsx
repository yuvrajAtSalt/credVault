import { redirect } from "next/navigation";

export default function HomePage() {
  // Root redirects to dashboard — app shell is in (vault) layout
  redirect("/dashboard");
}
