import { Minus, Equal, TrendingDown, TrendingUp } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

function DeltaBadge({ percent, positivoQuandoSobe }: { percent: number | null; positivoQuandoSobe: boolean }) {
  if (percent === null || Math.abs(percent) < 0.05) return null;
  const subiu = percent >= 0;
  const bom = subiu === positivoQuandoSobe;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", bom ? "text-status-good" : "text-status-critical")}>
      {subiu ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {Math.abs(percent).toFixed(1)}%
    </span>
  );
}

function Chip({
  label,
  value,
  tone,
  sub,
  deltaPercent,
  positivoQuandoSobe = true,
}: {
  label: string;
  value: number;
  tone: "good" | "serious" | "critical" | "auto";
  sub?: string;
  deltaPercent?: number | null;
  positivoQuandoSobe?: boolean;
}) {
  const resolvedTone = tone === "auto" ? (value >= 0 ? "good" : "critical") : tone;
  const toneClasses = {
    good: "bg-status-good/10 text-status-good ring-status-good/20",
    serious: "bg-status-serious/10 text-[#b8552f] ring-status-serious/25 dark:text-status-serious",
    critical: "bg-status-critical/10 text-status-critical ring-status-critical/20",
  } as const;

  return (
    <div
      className={cn(
        "flex min-w-[9.5rem] flex-1 flex-col gap-1 rounded-xl px-4 py-3 ring-1",
        toneClasses[resolvedTone]
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium opacity-80">{label}</span>
        {deltaPercent !== undefined && <DeltaBadge percent={deltaPercent} positivoQuandoSobe={positivoQuandoSobe} />}
      </div>
      <span className="font-mono text-lg font-semibold tabular-nums">{formatBRL(value)}</span>
      {sub && <span className="text-xs opacity-70">{sub}</span>}
    </div>
  );
}

export function KpiEquationBar({
  receitaVendas,
  custosColheita,
  despesasGerais,
  lucroLiquido,
  margemLucro,
  deltas,
}: {
  receitaVendas: number;
  custosColheita: number;
  despesasGerais: number;
  lucroLiquido: number;
  margemLucro: number;
  deltas?: {
    receitaVendas: number | null;
    custosColheita: number | null;
    despesasGerais: number | null;
    lucroLiquido: number | null;
  };
}) {
  const positivo = lucroLiquido >= 0;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4">
      <Chip
        label="Receita de Vendas"
        value={receitaVendas}
        tone="good"
        deltaPercent={deltas?.receitaVendas}
        positivoQuandoSobe
      />
      <Minus className="size-5 shrink-0 text-muted-foreground" />
      <Chip
        label="Custos de Colheita"
        value={-custosColheita}
        tone="serious"
        deltaPercent={deltas?.custosColheita}
        positivoQuandoSobe={false}
      />
      <Minus className="size-5 shrink-0 text-muted-foreground" />
      <Chip
        label="Despesas Gerais"
        value={-despesasGerais}
        tone="critical"
        deltaPercent={deltas?.despesasGerais}
        positivoQuandoSobe={false}
      />
      <Equal className="size-5 shrink-0 text-muted-foreground" />
      <Chip
        label="Lucro Líquido"
        value={lucroLiquido}
        tone="auto"
        sub={`Margem: ${margemLucro.toFixed(1)}%`}
        deltaPercent={deltas?.lucroLiquido}
        positivoQuandoSobe
      />
      <div
        className={cn(
          "flex items-center gap-1.5 self-center rounded-full px-3 py-1.5 text-xs font-medium",
          positivo
            ? "bg-status-good/10 text-status-good"
            : "bg-status-critical/10 text-status-critical"
        )}
      >
        {positivo ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
        {positivo ? "Lucro" : "Prejuízo"}
      </div>
    </div>
  );
}
