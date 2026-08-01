import type { Metadata } from "next";
import { requireFazenda } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { deleteDespesa } from "@/lib/actions/despesa";
import { NovaDespesaDialog } from "@/components/forms/nova-despesa-dialog";
import { DeleteButton } from "@/components/forms/delete-button";
import { QuerySelectFilter } from "@/components/tables/query-select-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CATEGORIA_DESPESA_LABEL, PRODUTO_LABEL, formatBRL } from "@/lib/format";
import { CategoriaDespesa } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Despesas — AGROcore" };

export default async function DespesasPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; tipo?: string }>;
}) {
  const usuario = await requireFazenda();
  const { categoria, tipo } = await searchParams;

  const despesas = await db.despesa.findMany({
    where: {
      fazendaId: usuario.fazendaId,
      ...(categoria ? { categoria: categoria as CategoriaDespesa } : {}),
      ...(tipo === "producao" ? { custoProducao: true } : {}),
      ...(tipo === "geral" ? { custoProducao: false } : {}),
    },
    orderBy: [{ data: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  const totalFiltrado = despesas.reduce((s, d) => s + Number(d.total), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Despesas</h1>
          <p className="text-sm text-muted-foreground">
            Custos de produção (vinculados a um produto) e despesas gerais do negócio.
          </p>
        </div>
        <NovaDespesaDialog />
      </div>

      <div className="flex flex-wrap gap-2">
        <QuerySelectFilter
          paramName="tipo"
          placeholder="Tipo"
          allLabel="Todos os tipos"
          options={[
            { value: "producao", label: "Custo de produção" },
            { value: "geral", label: "Despesa geral" },
          ]}
        />
        <QuerySelectFilter
          paramName="categoria"
          placeholder="Categoria"
          allLabel="Todas as categorias"
          options={Object.entries(CATEGORIA_DESPESA_LABEL).map(([value, label]) => ({ value, label }))}
        />
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {despesas.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR").format(d.data)}
                  </TableCell>
                  <TableCell>{CATEGORIA_DESPESA_LABEL[d.categoria]}</TableCell>
                  <TableCell>
                    <Badge variant={d.custoProducao ? "default" : "secondary"}>
                      {d.custoProducao ? "Custo de produção" : "Despesa geral"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.produto ? PRODUTO_LABEL[d.produto] : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatBRL(Number(d.total))}</TableCell>
                  <TableCell>
                    <DeleteButton action={deleteDespesa.bind(null, d.id)} label="essa despesa" />
                  </TableCell>
                </TableRow>
              ))}
              {despesas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhuma despesa encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Total no filtro atual: <span className="font-mono font-medium text-foreground">{formatBRL(totalFiltrado)}</span>
      </p>
    </div>
  );
}
