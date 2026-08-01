import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRODUTO_LABEL, formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ResumoPorProduto } from "@/lib/financeiro/aggregate";

export function RankingProdutos({ porProduto }: { porProduto: ResumoPorProduto[] }) {
  const dados = porProduto
    .filter((p) => p.receita > 0 || p.custosColheita > 0 || p.despesasGerais > 0)
    .sort((a, b) => b.margem - a.margem);

  if (dados.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead className="text-right">Receita</TableHead>
          <TableHead className="text-right">Lucro</TableHead>
          <TableHead className="text-right">Margem</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dados.map((p) => (
          <TableRow key={p.produto}>
            <TableCell className="font-medium">{PRODUTO_LABEL[p.produto]}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{formatBRL(p.receita)}</TableCell>
            <TableCell
              className={cn(
                "text-right font-mono tabular-nums",
                p.lucro >= 0 ? "text-status-good" : "text-status-critical"
              )}
            >
              {formatBRL(p.lucro)}
            </TableCell>
            <TableCell
              className={cn(
                "text-right font-mono tabular-nums",
                p.margem >= 0 ? "text-status-good" : "text-status-critical"
              )}
            >
              {p.margem.toFixed(1)}%
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
