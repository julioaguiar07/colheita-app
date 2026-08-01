import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";

export default async function RootPage() {
  const usuario = await verifySession();
  if (!usuario) redirect("/login");
  redirect(usuario.role === "ADMIN" ? "/admin" : "/dashboard");
}
