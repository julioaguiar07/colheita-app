import type { Metadata } from "next";
import { AlertTriangle, Package } from "lucide-react";
import { requireFazenda } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { deleteMovimentacao } from "@/lib/actions/estoque";
import { NovaMovimentacaoDialog } from "@/components/forms/nova-movimentacao-dialog";
import { DeleteButton } from "@/components/forms/delete-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRODUTO_LABEL, UNIDADE_LABEL, formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Estoque — AGROcore" };

export default async function EstoquePage() {
  const usuario = await requireFazenda();

  const [saldos, movimentos] = await Promise.all([
    db.estoqueSaldo.findMany({ where: { fazendaId: usuario.fazendaId }, orderBy: { produto: "asc" } }),
    db.estoqueMovimentacao.findMany({
      where: { fazendaId: usuario.fazendaId },
      orderBy: [{ data: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Estoque</h1>
          <p className="text-sm text-muted-foreground">
            Saldo atual e custo médio ponderado por produto, com histórico de movimentações.
          </p>
        </div>
        <NovaMovimentacaoDialog />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {saldos.map((s) => {
          const baixo = s.qtdMinima !== null && Number(s.qtdAtual) <= Number(s.qtdMinima);
          return (
            <Card key={s.id} className={cn(baixo && "border-status-warning/40 bg-status-warning/5")}>
              <CardContent className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Package className="size-4 text-muted-foreground" />
                    {PRODUTO_LABEL[s.produto]}
                  </span>
                  {baixo && <AlertTriangle className="size-4 text-status-warning" />}
                </div>
                <span className="font-mono text-2xl font-semibold tabular-nums">
                  {Number(s.qtdAtual)} <span className="text-sm font-normal text-muted-foreground">{UNIDADE_LABEL[s.unidade]}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Custo médio: {formatBRL(Number(s.custoMedioAtual))}/{UNIDADE_LABEL[s.unidade].toLowerCase()}
                </span>
                <span className="text-xs text-muted-foreground">
                  Valor em estoque: {formatBRL(Number(s.valorTotalAtual))}
                </span>
              </CardContent>
            </Card>
          );
        })}
        {saldos.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
            Nenhuma movimentação de estoque registrada ainda.
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead className="text-right">Custo unit.</TableHead>
                <TableHead>Obs</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentos.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR").format(m.data)}
                  </TableCell>
                  <TableCell>{PRODUTO_LABEL[m.produto]}</TableCell>
                  <TableCell>
                    <Badge variant={m.tipo === "ENTRADA" ? "default" : "secondary"}>
                      {m.tipo === "ENTRADA" ? "Entrada" : "Saída"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {Number(m.qtd)} {UNIDADE_LABEL[m.unidade]}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {m.custoUnitario ? formatBRL(Number(m.custoUnitario)) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.obs ?? (m.vendaId ? "Saída automática por venda" : "—")}
                  </TableCell>
                  <TableCell>
                    {!m.vendaId && <DeleteButton action={deleteMovimentacao.bind(null, m.id)} label="essa movimentação" />}
                  </TableCell>
                </TableRow>
              ))}
              {movimentos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhuma movimentação encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
