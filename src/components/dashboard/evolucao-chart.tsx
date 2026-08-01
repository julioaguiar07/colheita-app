"use client";

import { Bar, ComposedChart, Line, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatYm } from "@/lib/format";
import type { ResumoPorMes } from "@/lib/financeiro/aggregate";

const chartConfig = {
  receita: { label: "Receita", color: "var(--status-good)" },
  custosTotal: { label: "Custos + Despesas", color: "var(--status-critical)" },
  lucro: { label: "Lucro", color: "var(--primary)" },
} satisfies ChartConfig;

export function EvolucaoChart({ porMes }: { porMes: ResumoPorMes[] }) {
  const data = porMes.map((m) => ({
    ym: formatYm(m.ym),
    receita: Math.round(m.receita),
    custosTotal: Math.round(m.custosColheita + m.despesasGerais),
    lucro: Math.round(m.lucro),
  }));

  return (
    <ChartContainer config={chartConfig} className="h-72 w-full">
      <ComposedChart data={data}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="ym" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="receita" fill="var(--color-receita)" radius={4} />
        <Bar dataKey="custosTotal" fill="var(--color-custosTotal)" radius={4} />
        <Line
          dataKey="lucro"
          type="monotone"
          stroke="var(--color-lucro)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
