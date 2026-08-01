import { Sprout, LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sprout className="size-4" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold">AGROcore — Administração</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{usuario.nome ?? usuario.email}</span>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut /> Sair
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
