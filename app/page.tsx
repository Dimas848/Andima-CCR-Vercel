import { redirect } from "next/navigation";

export default function RootPage() {
  // Langsung arahkan ke Dashboard C2
  redirect("/dashboard");
}