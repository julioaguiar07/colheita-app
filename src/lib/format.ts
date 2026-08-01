export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

export const PRODUTO_LABEL: Record<string, string> = {
  CASTANHA: "Castanha",
  LENHA: "Lenha",
  ACEROLA: "Acerola",
  CAJU: "Caju",
  OUTRO: "Outro",
};

export const UNIDADE_LABEL: Record<string, string> = {
  KG: "Kg",
  BALDE: "Balde",
  CAIXA: "Caixa",
  UNIDADE: "Unidade",
  OUTRO: "Outro",
};

export const CATEGORIA_DESPESA_LABEL: Record<string, string> = {
  COLHEITA: "Colheita",
  MAO_DE_OBRA: "Mão de obra",
  ADUBO: "Adubo",
  COMBUSTIVEL: "Combustível",
  MANUTENCAO: "Manutenção",
  INSUMOS: "Insumos",
  OUTROS: "Outros",
};

export const MES_LABEL_CURTO = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export function formatYm(ym: string) {
  const [ano, mes] = ym.split("-");
  return `${MES_LABEL_CURTO[Number(mes) - 1]}/${ano.slice(2)}`;
}
