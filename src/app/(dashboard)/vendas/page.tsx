import type { Metadata } from "next";
import { requireFazenda } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { deleteVenda } from "@/lib/actions/venda";
import { NovaVendaDialog } from "@/components/forms/nova-venda-dialog";
import { DeleteButton } from "@/components/forms/delete-button";
import { QuerySelectFilter } from "@/components/tables/query-select-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRODUTO_LABEL, UNIDADE_LABEL, formatBRL } from "@/lib/format";
import { Produto } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Vendas — AGROcore" };

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ produto?: string; cliente?: string }>;
}) {
  const usuario = await requireFazenda();
  const { produto, cliente } = await searchParams;

  // Cliente é texto livre — as opções do filtro vêm dos valores já registrados.
  const clientesRegistrados = await db.venda.findMany({
    where: { fazendaId: usuario.fazendaId, cliente: { not: null } },
    select: { cliente: true },
    distinct: ["cliente"],
    orderBy: { cliente: "asc" },
  });
  const opcoesCliente = clientesRegistrados
    .map((v) => v.cliente!.trim())
    .filter((c) => c.length > 0)
    .map((c) => ({ value: c, label: c }));

  const vendas = await db.venda.findMany({
    where: {
      fazendaId: usuario.fazendaId,
      ...(produto ? { produto: produto as Produto } : {}),
      ...(cliente ? { cliente } : {}),
    },
    orderBy: [{ data: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  const totalFiltrado = vendas.reduce((s, v) => s + Number(v.total), 0);

  const porCliente = new Map<string, number>();
  for (const v of vendas) {
    const chave = v.cliente?.trim() || "Não informado";
    porCliente.set(chave, (porCliente.get(chave) ?? 0) + Number(v.total));
  }
  const topClientes = Array.from(porCliente.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maiorValorCliente = topClientes[0]?.[1] ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Vendas</h1>
          <p className="text-sm text-muted-foreground">Receita da fazenda por produto e cliente.</p>
        </div>
        <NovaVendaDialog />
      </div>

      <div className="flex flex-wrap gap-2">
        <QuerySelectFilter
          paramName="produto"
          placeholder="Produto"
          allLabel="Todos os produtos"
          options={Object.entries(PRODUTO_LABEL).map(([value, label]) => ({ value, label }))}
        />
        {opcoesCliente.length > 0 && (
          <QuerySelectFilter
            paramName="cliente"
            placeholder="Cliente"
            allLabel="Todos os clientes"
            options={opcoesCliente}
          />
        )}
      </div>

      {topClientes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top clientes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {topClientes.map(([cliente, total]) => (
              <div key={cliente} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-sm text-muted-foreground">{cliente}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${maiorValorCliente > 0 ? (total / maiorValorCliente) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-sm tabular-nums">{formatBRL(total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead className="text-right">Preço unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR").format(v.data)}
                  </TableCell>
                  <TableCell>{PRODUTO_LABEL[v.produto]}</TableCell>
                  <TableCell className="text-muted-foreground">{v.cliente ?? "—"}</TableCell>
                  <TableCell>
                    {Number(v.qtd)} {UNIDADE_LABEL[v.unidade]}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatBRL(Number(v.valorUnit))}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-medium">
                    {formatBRL(Number(v.total))}
                  </TableCell>
                  <TableCell>
                    <DeleteButton action={deleteVenda.bind(null, v.id)} label="essa venda" />
                  </TableCell>
                </TableRow>
              ))}
              {vendas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhuma venda encontrada.
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
