"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { PRODUTO_LABEL } from "@/lib/format";
import type { ResumoPorProduto } from "@/lib/financeiro/aggregate";

const PRODUTO_COLOR: Record<string, string> = {
  CASTANHA: "var(--chart-1)",
  LENHA: "var(--chart-2)",
  ACEROLA: "var(--chart-3)",
  CAJU: "var(--chart-4)",
  OUTRO: "var(--chart-5)",
};

const chartConfig = {
  receita: { label: "Receita" },
} satisfies ChartConfig;

export function ProdutoBreakdownChart({ porProduto }: { porProduto: ResumoPorProduto[] }) {
  const data = porProduto
    .filter((p) => p.receita > 0 || p.custosColheita > 0 || p.despesasGerais > 0)
    .map((p) => ({
      produto: PRODUTO_LABEL[p.produto] ?? p.produto,
      receita: Math.round(p.receita),
      fill: PRODUTO_COLOR[p.produto] ?? "var(--chart-5)",
    }));

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} />
        <YAxis dataKey="produto" type="category" tickLine={false} axisLine={false} width={80} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="receita" radius={4}>
          {data.map((entry) => (
            <Cell key={entry.produto} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
