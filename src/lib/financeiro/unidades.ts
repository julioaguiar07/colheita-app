import { UnidadeMedida } from "@/generated/prisma/enums";

/**
 * Approximate unit→kg factors so quantities recorded in balde/caixa/unidade can be
 * combined with kg-denominated ones for per-kg metrics (custo médio, margem por kg).
 * These are rough conversions (a "balde" varies by product), inherited from the
 * original app's heuristic — not a precise weighing.
 */
const FATOR_KG: Record<UnidadeMedida, number> = {
  KG: 1,
  BALDE: 20,
  CAIXA: 15,
  UNIDADE: 0.5,
  OUTRO: 1,
};

export function somaEmKg(itens: { qtd: number; unidade: UnidadeMedida }[]): number {
  return itens.reduce((soma, item) => soma + item.qtd * FATOR_KG[item.unidade], 0);
}
