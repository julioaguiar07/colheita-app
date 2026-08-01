import { requireFazenda } from "@/lib/auth/dal";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireFazenda();

  return (
    <SidebarProvider>
      <AppSidebar fazendaNome={usuario.fazendaNome} />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <Topbar title={usuario.fazendaNome ?? "Painel"} nome={usuario.nome} email={usuario.email} />
        <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-x-hidden p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
