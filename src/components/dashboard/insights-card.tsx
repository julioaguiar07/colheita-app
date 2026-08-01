import { Sparkles } from "lucide-react";

export function InsightsCard({ insights }: { insights: string[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Destaques do período</h2>
      </div>
      <ul className="flex flex-col gap-2">
        {insights.map((insight) => (
          <li key={insight} className="flex gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
            {insight}
          </li>
        ))}
      </ul>
    </div>
  );
}
