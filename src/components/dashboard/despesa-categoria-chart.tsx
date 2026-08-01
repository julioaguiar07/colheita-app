"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { CATEGORIA_DESPESA_LABEL } from "@/lib/format";
import type { ResumoPorCategoria } from "@/lib/financeiro/aggregate";

const chartConfig = {
  producao: { label: "Custo de produção", color: "var(--status-serious)" },
  geral: { label: "Despesa geral", color: "var(--status-critical)" },
} satisfies ChartConfig;

export function DespesaCategoriaChart({ porCategoria }: { porCategoria: ResumoPorCategoria[] }) {
  const porCategoriaLabel = new Map<string, { categoria: string; producao: number; geral: number }>();

  for (const c of porCategoria) {
    const label = CATEGORIA_DESPESA_LABEL[c.categoria] ?? c.categoria;
    const entry = porCategoriaLabel.get(label) ?? { categoria: label, producao: 0, geral: 0 };
    if (c.custoProducao) entry.producao += c.total;
    else entry.geral += c.total;
    porCategoriaLabel.set(label, entry);
  }

  const data = Array.from(porCategoriaLabel.values())
    .map((d) => ({ ...d, producao: Math.round(d.producao), geral: Math.round(d.geral) }))
    .sort((a, b) => b.producao + b.geral - (a.producao + a.geral));

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} />
        <YAxis dataKey="categoria" type="category" tickLine={false} axisLine={false} width={100} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="producao" stackId="a" fill="var(--color-producao)" radius={[4, 0, 0, 4]} />
        <Bar dataKey="geral" stackId="a" fill="var(--color-geral)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
