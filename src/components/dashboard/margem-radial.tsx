"use client";

import { RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const chartConfig = { margem: { label: "Margem" } } satisfies ChartConfig;

export function MargemRadial({ margem }: { margem: number }) {
  const clamped = Math.max(-100, Math.min(100, margem));
  const displayValue = Math.max(0, clamped);
  const positivo = margem >= 0;

  const data = [{ margem: displayValue, fill: positivo ? "var(--status-good)" : "var(--status-critical)" }];

  return (
    <div className="relative flex items-center justify-center">
      <ChartContainer config={chartConfig} className="mx-auto aspect-square h-40 w-40">
        <RadialBarChart
          data={data}
          startAngle={90}
          endAngle={-270}
          innerRadius="72%"
          outerRadius="100%"
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          <RadialBar dataKey="margem" background={{ fill: "var(--muted)" }} cornerRadius={12} />
        </RadialBarChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-mono text-2xl font-semibold tabular-nums",
            positivo ? "text-status-good" : "text-status-critical"
          )}
        >
          {margem.toFixed(1)}%
        </span>
        <span className="text-xs text-muted-foreground">margem</span>
      </div>
    </div>
  );
}
