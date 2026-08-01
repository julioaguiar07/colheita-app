import Anthropic from "@anthropic-ai/sdk";
import { PRODUTO_LABEL, CATEGORIA_DESPESA_LABEL, formatBRL } from "@/lib/format";
import type { ComparativoPeriodoAnterior } from "@/lib/financeiro/aggregate";

function saudacao(): string {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Fortaleza" }).format(
      new Date()
    )
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function montarContexto(params: {
  nome: string;
  fazendaNome: string;
  comparativo: ComparativoPeriodoAnterior;
  alertasEstoque: string[];
}): string {
  const { atual, deltas } = params.comparativo;

  const produtos = atual.porProduto
    .filter((p) => p.receita > 0 || p.custosColheita > 0 || p.despesasGerais > 0)
    .map(
      (p) =>
        `${PRODUTO_LABEL[p.produto]}: receita ${formatBRL(p.receita)}, lucro ${formatBRL(p.lucro)}, margem ${p.margem.toFixed(1)}%`
    );

  const categorias = atual.porCategoria
    .slice(0, 5)
    .map((c) => `${CATEGORIA_DESPESA_LABEL[c.categoria]} (${c.custoProducao ? "custo de produção" : "despesa geral"}): ${formatBRL(c.total)}`);

  const fmtDelta = (d: { variacaoPercentual: number | null }) =>
    d.variacaoPercentual === null ? "sem período anterior para comparar" : `${d.variacaoPercentual >= 0 ? "+" : ""}${d.variacaoPercentual.toFixed(1)}%`;

  return `
Fazenda: ${params.fazendaNome}
Usuário: ${params.nome}
Período analisado: ${atual.periodoInicio.toLocaleDateString("pt-BR")} a ${atual.periodoFim.toLocaleDateString("pt-BR")}

RESUMO FINANCEIRO DO PERÍODO:
- Receita de vendas: ${formatBRL(atual.receitaVendas)} (variação vs período anterior: ${fmtDelta(deltas.receitaVendas)})
- Custos de colheita: ${formatBRL(atual.custosColheita)} (variação: ${fmtDelta(deltas.custosColheita)})
- Despesas gerais: ${formatBRL(atual.despesasGerais)} (variação: ${fmtDelta(deltas.despesasGerais)})
- Lucro líquido: ${formatBRL(atual.lucroLiquido)} (variação: ${fmtDelta(deltas.lucroLiquido)})
- Margem de lucro: ${atual.margemLucro.toFixed(1)}%

DESEMPENHO POR PRODUTO:
${produtos.length > 0 ? produtos.join("\n") : "Nenhum dado de produto no período."}

MAIORES CATEGORIAS DE DESPESA:
${categorias.length > 0 ? categorias.join("\n") : "Nenhuma despesa registrada no período."}

ALERTAS DE ESTOQUE:
${params.alertasEstoque.length > 0 ? params.alertasEstoque.join("\n") : "Nenhum alerta de estoque baixo."}
`.trim();
}

function resumoLocal(params: {
  nome: string;
  comparativo: ComparativoPeriodoAnterior;
  alertasEstoque: string[];
}): string {
  const { atual } = params.comparativo;
  const primeiroNome = params.nome.split(" ")[0];
  const positivo = atual.lucroLiquido >= 0;
  const melhor = [...atual.porProduto].filter((p) => p.receita > 0).sort((a, b) => b.margem - a.margem)[0];

  const partes = [
    `${saudacao()}, ${primeiroNome}. No período, sua fazenda teve receita de ${formatBRL(atual.receitaVendas)} e ${positivo ? "lucro líquido" : "prejuízo"} de ${formatBRL(Math.abs(atual.lucroLiquido))}, uma margem de ${atual.margemLucro.toFixed(1)}%.`,
  ];
  if (melhor) {
    partes.push(`${PRODUTO_LABEL[melhor.produto]} foi o produto com melhor desempenho, com margem de ${melhor.margem.toFixed(1)}%.`);
  }
  if (params.alertasEstoque.length > 0) {
    partes.push(`Atenção: ${params.alertasEstoque.join("; ")}.`);
  }
  return partes.join(" ");
}

export async function gerarResumoInteligente(params: {
  nome: string;
  fazendaNome: string;
  comparativo: ComparativoPeriodoAnterior;
  alertasEstoque: string[];
}): Promise<{ texto: string; fonte: "ia" | "local" }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return { texto: resumoLocal(params), fonte: "local" };
  }

  const client = new Anthropic({ apiKey });
  const contexto = montarContexto(params);

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 500,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system:
        "Você é um analista de dados agrícolas que escreve resumos executivos curtos e diretos para o dono de uma fazenda de caju, castanha, lenha e acerola. " +
        `Comece com a saudação "${saudacao()}, [primeiro nome].". ` +
        "Escreva de 3 a 5 frases em português do Brasil, em um parágrafo só, tom profissional e caloroso — como um consultor de confiança, não um robô. " +
        "Use APENAS os números fornecidos no contexto — nunca invente, estime ou arredonde de forma enganosa métricas que não foram dadas (como 'eficiência esperada' ou 'meta', a menos que apareçam explicitamente nos dados). " +
        "Destaque o que for mais acionável: o produto de melhor ou pior desempenho, uma variação relevante vs período anterior, ou um alerta de estoque. " +
        "Não use markdown, listas, emojis ou títulos — apenas texto corrido.",
      messages: [{ role: "user", content: contexto }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const texto = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";

    if (!texto) {
      return { texto: resumoLocal(params), fonte: "local" };
    }

    return { texto, fonte: "ia" };
  } catch (error) {
    console.error("[resumo-inteligente] Erro ao chamar Claude:", error);
    return { texto: resumoLocal(params), fonte: "local" };
  }
}
