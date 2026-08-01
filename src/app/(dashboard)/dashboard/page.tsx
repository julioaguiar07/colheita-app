import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { requireFazenda } from "@/lib/auth/dal";
import { getComparativoPeriodoAnterior, gerarInsights } from "@/lib/financeiro/aggregate";
import { resolvePeriodo, type PeriodoPreset } from "@/lib/financeiro/periodo";
import { db } from "@/lib/db";
import { KpiEquationBar } from "@/components/dashboard/kpi-equation-bar";
import { EvolucaoChart } from "@/components/dashboard/evolucao-chart";
import { ProdutoBreakdownChart } from "@/components/dashboard/produto-breakdown-chart";
import { DespesaCategoriaChart } from "@/components/dashboard/despesa-categoria-chart";
import { RankingProdutos } from "@/components/dashboard/ranking-produtos";
import { InsightsCard } from "@/components/dashboard/insights-card";
import { MargemRadial } from "@/components/dashboard/margem-radial";
import { PeriodoSelect } from "@/components/dashboard/periodo-select";
import { ResumoInteligenteButton } from "@/components/dashboard/resumo-inteligente-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUTO_LABEL } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard — AGROcore" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const usuario = await requireFazenda();
  const { periodo } = await searchParams;
  const { inicio, fim, preset } = resolvePeriodo(periodo);

  const [comparativo, estoqueBaixo] = await Promise.all([
    getComparativoPeriodoAnterior({ fazendaId: usuario.fazendaId, periodoInicio: inicio, periodoFim: fim }),
    db.estoqueSaldo.findMany({
      where: { fazendaId: usuario.fazendaId, qtdMinima: { not: null } },
    }),
  ]);

  const resumo = comparativo.atual;
  const insights = gerarInsights(comparativo);

  const alertasEstoque = estoqueBaixo.filter(
    (s) => s.qtdMinima !== null && Number(s.qtdAtual) <= Number(s.qtdMinima)
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Resumo financeiro</h1>
          <p className="text-sm text-muted-foreground">
            {usuario.fazendaNome} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(inicio)} —{" "}
            {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(fim)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ResumoInteligenteButton nomeUsuario={usuario.nome ?? usuario.email} />
          <PeriodoSelect value={preset as PeriodoPreset} />
        </div>
      </div>

      {alertasEstoque.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl bg-status-warning/10 p-3 text-sm">
          {alertasEstoque.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-[#8a5a12]">
              <AlertTriangle className="size-4 shrink-0" />
              Estoque de {PRODUTO_LABEL[a.produto]} está baixo: {Number(a.qtdAtual)} {a.unidade} (mínimo{" "}
              {Number(a.qtdMinima)})
            </div>
          ))}
        </div>
      )}

      <KpiEquationBar
        receitaVendas={resumo.receitaVendas}
        custosColheita={resumo.custosColheita}
        despesasGerais={resumo.despesasGerais}
        lucroLiquido={resumo.lucroLiquido}
        margemLucro={resumo.margemLucro}
        deltas={{
          receitaVendas: comparativo.deltas.receitaVendas.variacaoPercentual,
          custosColheita: comparativo.deltas.custosColheita.variacaoPercentual,
          despesasGerais: comparativo.deltas.despesasGerais.variacaoPercentual,
          lucroLiquido: comparativo.deltas.lucroLiquido.variacaoPercentual,
        }}
      />

      <InsightsCard insights={insights} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolução do negócio</CardTitle>
          </CardHeader>
          <CardContent>
            <EvolucaoChart porMes={resumo.porMes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Margem de lucro</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <MargemRadial margem={resumo.margemLucro} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Receita por produto</CardTitle>
          </CardHeader>
          <CardContent>
            <ProdutoBreakdownChart porProduto={resumo.porProduto} />
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
              <p className="py-16 text-center text-sm text-muted-foreground">Nenhuma despesa no período.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ranking de produtos por margem</CardTitle>
        </CardHeader>
        <CardContent>
          <RankingProdutos porProduto={resumo.porProduto} />
        </CardContent>
      </Card>
    </div>
  );
}
