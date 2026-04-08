import { redirect } from "next/navigation";

export default function HomePage() {
  // Root redirects to login — app shell is in (vault) layout
  redirect("/login");
}
