import { db } from "@/lib/db";
import { Produto, CategoriaDespesa } from "@/generated/prisma/enums";
import { PRODUTO_LABEL, CATEGORIA_DESPESA_LABEL } from "@/lib/format";

export interface ResumoPorProduto {
  produto: Produto;
  receita: number;
  custosColheita: number;
  despesasGerais: number;
  lucro: number;
  margem: number;
}

export interface ResumoPorMes {
  ym: string;
  receita: number;
  custosColheita: number;
  despesasGerais: number;
  lucro: number;
}

export interface ResumoPorCategoria {
  categoria: CategoriaDespesa;
  custoProducao: boolean;
  total: number;
}

export interface ResumoFinanceiro {
  fazendaId: string;
  periodoInicio: Date;
  periodoFim: Date;
  receitaVendas: number;
  custosColheita: number;
  despesasGerais: number;
  lucroLiquido: number;
  margemLucro: number;
  porProduto: ResumoPorProduto[];
  porMes: ResumoPorMes[];
  porCategoria: ResumoPorCategoria[];
}

function ymDe(data: Date): string {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Single source of truth for lucro líquido = receita_vendas − custos_colheita − despesas_gerais.
 * Every dashboard KPI, PDF report and CSV export must go through this — never re-derive
 * the formula inline (that duplication across ~12 call sites was the root of the old app's
 * KPI-legibility complaints).
 */
export async function getResumoFinanceiro(params: {
  fazendaId: string;
  periodoInicio: Date;
  periodoFim: Date;
  produto?: Produto;
}): Promise<ResumoFinanceiro> {
  const { fazendaId, periodoInicio, periodoFim, produto: produtoFiltro } = params;
  const whereData = { gte: periodoInicio, lte: periodoFim };

  const [vendas, despesas] = await Promise.all([
    db.venda.findMany({
      where: { fazendaId, data: whereData, ...(produtoFiltro ? { produto: produtoFiltro } : {}) },
      select: { data: true, produto: true, total: true },
    }),
    db.despesa.findMany({
      where: { fazendaId, data: whereData, ...(produtoFiltro ? { produto: produtoFiltro } : {}) },
      select: { data: true, produto: true, total: true, categoria: true, custoProducao: true },
    }),
  ]);

  const porProdutoMap = new Map<Produto, ResumoPorProduto>();
  const porMesMap = new Map<string, ResumoPorMes>();
  const porCategoriaMap = new Map<string, ResumoPorCategoria>();

  const ensureProduto = (produto: Produto) => {
    let entry = porProdutoMap.get(produto);
    if (!entry) {
      entry = { produto, receita: 0, custosColheita: 0, despesasGerais: 0, lucro: 0, margem: 0 };
      porProdutoMap.set(produto, entry);
    }
    return entry;
  };

  const ensureMes = (ym: string) => {
    let entry = porMesMap.get(ym);
    if (!entry) {
      entry = { ym, receita: 0, custosColheita: 0, despesasGerais: 0, lucro: 0 };
      porMesMap.set(ym, entry);
    }
    return entry;
  };

  let receitaVendas = 0;
  for (const v of vendas) {
    const total = Number(v.total);
    receitaVendas += total;
    ensureProduto(v.produto).receita += total;
    ensureMes(ymDe(v.data)).receita += total;
  }

  let custosColheita = 0;
  let despesasGerais = 0;
  for (const d of despesas) {
    const total = Number(d.total);
    const catKey = `${d.categoria}_${d.custoProducao}`;
    const catEntry = porCategoriaMap.get(catKey) ?? {
      categoria: d.categoria,
      custoProducao: d.custoProducao,
      total: 0,
    };
    catEntry.total += total;
    porCategoriaMap.set(catKey, catEntry);

    if (d.custoProducao) {
      custosColheita += total;
      if (d.produto) ensureProduto(d.produto).custosColheita += total;
      ensureMes(ymDe(d.data)).custosColheita += total;
    } else {
      despesasGerais += total;
      if (d.produto) ensureProduto(d.produto).despesasGerais += total;
      ensureMes(ymDe(d.data)).despesasGerais += total;
    }
  }

  const lucroLiquido = receitaVendas - custosColheita - despesasGerais;
  const margemLucro = receitaVendas > 0 ? (lucroLiquido / receitaVendas) * 100 : 0;

  for (const entry of porProdutoMap.values()) {
    entry.lucro = entry.receita - entry.custosColheita - entry.despesasGerais;
    entry.margem = entry.receita > 0 ? (entry.lucro / entry.receita) * 100 : 0;
  }
  for (const entry of porMesMap.values()) {
    entry.lucro = entry.receita - entry.custosColheita - entry.despesasGerais;
  }

  return {
    fazendaId,
    periodoInicio,
    periodoFim,
    receitaVendas,
    custosColheita,
    despesasGerais,
    lucroLiquido,
    margemLucro,
    porProduto: Array.from(porProdutoMap.values()).sort((a, b) => b.receita - a.receita),
    porMes: Array.from(porMesMap.values()).sort((a, b) => a.ym.localeCompare(b.ym)),
    porCategoria: Array.from(porCategoriaMap.values()).sort((a, b) => b.total - a.total),
  };
}

export interface Delta {
  atual: number;
  anterior: number;
  variacaoAbsoluta: number;
  variacaoPercentual: number | null;
}

export interface ComparativoPeriodoAnterior {
  atual: ResumoFinanceiro;
  anterior: ResumoFinanceiro;
  deltas: {
    receitaVendas: Delta;
    custosColheita: Delta;
    despesasGerais: Delta;
    lucroLiquido: Delta;
  };
}

function calcularDelta(atual: number, anterior: number): Delta {
  return {
    atual,
    anterior,
    variacaoAbsoluta: atual - anterior,
    variacaoPercentual: anterior !== 0 ? ((atual - anterior) / Math.abs(anterior)) * 100 : null,
  };
}

/** Compares a period against the immediately preceding period of equal length. */
export async function getComparativoPeriodoAnterior(params: {
  fazendaId: string;
  periodoInicio: Date;
  periodoFim: Date;
  produto?: Produto;
}): Promise<ComparativoPeriodoAnterior> {
  const { fazendaId, periodoInicio, periodoFim, produto } = params;
  const duracaoMs = periodoFim.getTime() - periodoInicio.getTime();
  const periodoAnteriorFim = new Date(periodoInicio.getTime() - 24 * 60 * 60 * 1000);
  const periodoAnteriorInicio = new Date(periodoAnteriorFim.getTime() - duracaoMs);

  const [atual, anterior] = await Promise.all([
    getResumoFinanceiro({ fazendaId, periodoInicio, periodoFim, produto }),
    getResumoFinanceiro({ fazendaId, periodoInicio: periodoAnteriorInicio, periodoFim: periodoAnteriorFim, produto }),
  ]);

  return {
    atual,
    anterior,
    deltas: {
      receitaVendas: calcularDelta(atual.receitaVendas, anterior.receitaVendas),
      custosColheita: calcularDelta(atual.custosColheita, anterior.custosColheita),
      despesasGerais: calcularDelta(atual.despesasGerais, anterior.despesasGerais),
      lucroLiquido: calcularDelta(atual.lucroLiquido, anterior.lucroLiquido),
    },
  };
}

/** Rule-based textual insights — a lightweight stand-in for a real analytics layer. */
export function gerarInsights(comparativo: ComparativoPeriodoAnterior): string[] {
  const { atual, deltas } = comparativo;
  const insights: string[] = [];

  const produtosComReceita = atual.porProduto.filter((p) => p.receita > 0);
  if (produtosComReceita.length > 0) {
    const melhor = [...produtosComReceita].sort((a, b) => b.margem - a.margem)[0];
    insights.push(
      `${PRODUTO_LABEL[melhor.produto]} é o produto com melhor margem no período (${melhor.margem.toFixed(1)}%).`
    );

    if (produtosComReceita.length > 1) {
      const pior = [...produtosComReceita].sort((a, b) => a.margem - b.margem)[0];
      if (pior.produto !== melhor.produto && pior.margem < 15) {
        insights.push(
          `${PRODUTO_LABEL[pior.produto]} está com margem apertada (${pior.margem.toFixed(1)}%) — vale revisar custos.`
        );
      }
    }
  }

  if (deltas.receitaVendas.variacaoPercentual !== null) {
    const v = deltas.receitaVendas.variacaoPercentual;
    if (Math.abs(v) >= 5) {
      insights.push(
        `Receita ${v >= 0 ? "cresceu" : "caiu"} ${Math.abs(v).toFixed(1)}% em relação ao período anterior.`
      );
    }
  }

  if (deltas.custosColheita.variacaoPercentual !== null && deltas.custosColheita.variacaoPercentual >= 15) {
    insights.push(
      `Custos de colheita subiram ${deltas.custosColheita.variacaoPercentual.toFixed(1)}% em relação ao período anterior.`
    );
  }

  const maiorCategoria = atual.porCategoria.filter((c) => !c.custoProducao)[0];
  if (maiorCategoria && atual.despesasGerais > 0) {
    const pct = (maiorCategoria.total / atual.despesasGerais) * 100;
    if (pct >= 30) {
      insights.push(
        `${CATEGORIA_DESPESA_LABEL[maiorCategoria.categoria]} concentra ${pct.toFixed(0)}% das despesas gerais.`
      );
    }
  }

  if (atual.lucroLiquido < 0) {
    insights.push("O período fechou no prejuízo — receita não cobriu custos de colheita e despesas gerais.");
  } else if (atual.margemLucro >= 40) {
    insights.push(`Margem líquida saudável de ${atual.margemLucro.toFixed(1)}% no período.`);
  }

  return insights;
}
