"use server";

import { requireFazenda } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { getComparativoPeriodoAnterior } from "@/lib/financeiro/aggregate";
import { resolvePeriodo } from "@/lib/financeiro/periodo";
import { gerarResumoInteligente } from "@/lib/ai/resumo-inteligente";
import { PRODUTO_LABEL } from "@/lib/format";

export async function obterResumoInteligente(periodo?: string) {
  const usuario = await requireFazenda();
  const { inicio, fim } = resolvePeriodo(periodo);

  const [comparativo, estoqueBaixo] = await Promise.all([
    getComparativoPeriodoAnterior({ fazendaId: usuario.fazendaId, periodoInicio: inicio, periodoFim: fim }),
    db.estoqueSaldo.findMany({ where: { fazendaId: usuario.fazendaId, qtdMinima: { not: null } } }),
  ]);

  const alertasEstoque = estoqueBaixo
    .filter((s) => s.qtdMinima !== null && Number(s.qtdAtual) <= Number(s.qtdMinima))
    .map((s) => `estoque de ${PRODUTO_LABEL[s.produto]} está baixo (${Number(s.qtdAtual)} ${s.unidade}, mínimo ${Number(s.qtdMinima)})`);

  const resultado = await gerarResumoInteligente({
    nome: usuario.nome ?? usuario.email,
    fazendaNome: usuario.fazendaNome ?? "sua fazenda",
    comparativo,
    alertasEstoque,
  });

  return resultado;
}
