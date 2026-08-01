import type { Metadata } from "next";
import { requireFazenda } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { getResumoFinanceiro } from "@/lib/financeiro/aggregate";
import { resolvePeriodo, type PeriodoPreset } from "@/lib/financeiro/periodo";
import { KpiEquationBar } from "@/components/dashboard/kpi-equation-bar";
import { EvolucaoChart } from "@/components/dashboard/evolucao-chart";
import { DespesaCategoriaChart } from "@/components/dashboard/despesa-categoria-chart";
import { PeriodoSelect } from "@/components/dashboard/periodo-select";
import { ProdutoSelect } from "@/components/produtos/produto-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUTO_LABEL, formatBRL } from "@/lib/format";
import { Produto, UnidadeMedida } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Produtos — AGROcore" };

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ produto?: string; periodo?: string }>;
}) {
  const usuario = await requireFazenda();
  const { produto: produtoParam, periodo } = await searchParams;
  const { inicio, fim, preset } = resolvePeriodo(periodo);

  const [produtosVendas, produtosDespesas] = await Promise.all([
    db.venda.findMany({ where: { fazendaId: usuario.fazendaId }, select: { produto: true }, distinct: ["produto"] }),
    db.despesa.findMany({
      where: { fazendaId: usuario.fazendaId, custoProducao: true },
      select: { produto: true },
      distinct: ["produto"],
    }),
  ]);

  const disponiveis = Array.from(
    new Set([...produtosVendas.map((v) => v.produto), ...produtosDespesas.map((d) => d.produto).filter(Boolean)])
  ) as Produto[];

  if (disponiveis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
        <h1 className="text-lg font-semibold">Sem dados de produto ainda</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Assim que você registrar vendas ou custos de produção vinculados a um produto, a análise aparece aqui.
        </p>
      </div>
    );
  }

  const produtoSelecionado = disponiveis.includes(produtoParam as Produto)
    ? (produtoParam as Produto)
    : disponiveis[0];

  const [resumo, qtdVendidaKg, qtdProduzidaKg] = await Promise.all([
    getResumoFinanceiro({ fazendaId: usuario.fazendaId, periodoInicio: inicio, periodoFim: fim, produto: produtoSelecionado }),
    db.venda.aggregate({
      where: { fazendaId: usuario.fazendaId, produto: produtoSelecionado, unidade: UnidadeMedida.KG, data: { gte: inicio, lte: fim } },
      _sum: { qtd: true },
    }),
    db.despesa.aggregate({
      where: {
        fazendaId: usuario.fazendaId,
        produto: produtoSelecionado,
        custoProducao: true,
        unidade: UnidadeMedida.KG,
        data: { gte: inicio, lte: fim },
      },
      _sum: { qtd: true },
    }),
  ]);

  const qtdVendida = Number(qtdVendidaKg._sum.qtd ?? 0);
  const qtdProduzida = Number(qtdProduzidaKg._sum.qtd ?? 0);
  const precoMedioKg = qtdVendida > 0 ? resumo.receitaVendas / qtdVendida : null;
  const custoMedioKg = qtdProduzida > 0 ? resumo.custosColheita / qtdProduzida : null;
  const margemPorKg = precoMedioKg !== null && custoMedioKg !== null ? precoMedioKg - custoMedioKg : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Análise por produto</h1>
          <p className="text-sm text-muted-foreground">{PRODUTO_LABEL[produtoSelecionado]}</p>
        </div>
        <div className="flex gap-2">
          <ProdutoSelect value={produtoSelecionado} disponiveis={disponiveis} />
          <PeriodoSelect value={preset as PeriodoPreset} />
        </div>
      </div>

      <KpiEquationBar
        receitaVendas={resumo.receitaVendas}
        custosColheita={resumo.custosColheita}
        despesasGerais={resumo.despesasGerais}
        lucroLiquido={resumo.lucroLiquido}
        margemLucro={resumo.margemLucro}
      />

      {(precoMedioKg !== null || custoMedioKg !== null) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent>
              <p className="text-xs font-medium text-muted-foreground">Preço médio de venda / kg</p>
              <p className="font-mono text-xl font-semibold">{precoMedioKg !== null ? formatBRL(precoMedioKg) : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-xs font-medium text-muted-foreground">Custo médio de produção / kg</p>
              <p className="font-mono text-xl font-semibold">{custoMedioKg !== null ? formatBRL(custoMedioKg) : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-xs font-medium text-muted-foreground">Margem por kg</p>
              <p
                className="font-mono text-xl font-semibold"
                style={{ color: margemPorKg !== null && margemPorKg < 0 ? "var(--status-critical)" : "var(--status-good)" }}
              >
                {margemPorKg !== null ? formatBRL(margemPorKg) : "—"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evolução mensal — {PRODUTO_LABEL[produtoSelecionado]}</CardTitle>
          </CardHeader>
          <CardContent>
            <EvolucaoChart porMes={resumo.porMes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {resumo.porCategoria.length > 0 ? (
              <DespesaCategoriaChart porCategoria={resumo.porCategoria} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Nenhuma despesa vinculada a esse produto no período.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
