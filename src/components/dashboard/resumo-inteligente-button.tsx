"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, RotateCw } from "lucide-react";
import { obterResumoInteligente } from "@/lib/actions/resumo-inteligente";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ResumoInteligenteButton({ nomeUsuario }: { nomeUsuario: string }) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{ texto: string; fonte: "ia" | "local" } | null>(null);

  async function gerar() {
    setLoading(true);
    try {
      const periodo = searchParams.get("periodo") ?? undefined;
      const res = await obterResumoInteligente(periodo);
      setResultado(res);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && !resultado && !loading) {
      gerar();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        className="btn-shimmer relative gap-1.5 text-primary-foreground"
        onClick={() => handleOpenChange(true)}
      >
        <Sparkles className="size-4" />
        Resumo Inteligente
      </Button>

      <DialogContent className="overflow-hidden sm:max-w-lg" showCloseButton>
        <div
          className="-m-4 mb-0 flex items-center gap-3 border-b border-border p-5"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklch, var(--primary), transparent 88%), transparent)",
          }}
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary),transparent_85%)]">
            <Sparkles className={cn("size-5", loading && "animate-shimmer-pulse")} />
          </div>
          <div>
            <DialogHeader className="items-start gap-0 p-0 text-left">
              <DialogTitle className="text-base">Resumo Inteligente</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">Olá, {nomeUsuario.split(" ")[0]} — aqui está sua análise</p>
          </div>
        </div>

        <div className="min-h-32 py-2">
          {loading ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="size-3.5 animate-shimmer-pulse text-primary" />
                Analisando os dados da sua fazenda...
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : resultado ? (
            <p className="text-[15px] leading-relaxed text-foreground text-pretty">{resultado.texto}</p>
          ) : null}
        </div>

        {!loading && resultado && (
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              {resultado.fonte === "ia" ? "✨ Gerado por IA" : "Resumo automático"}
            </span>
            <Button variant="ghost" size="sm" onClick={gerar}>
              <RotateCw className="size-3.5" /> Gerar novamente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
