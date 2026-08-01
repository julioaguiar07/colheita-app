export type PeriodoPreset = "mes-atual" | "3-meses" | "6-meses" | "ano-atual";

export const PERIODO_PRESET_LABEL: Record<PeriodoPreset, string> = {
  "mes-atual": "Este mês",
  "3-meses": "Últimos 3 meses",
  "6-meses": "Últimos 6 meses",
  "ano-atual": "Este ano",
};

export function resolvePeriodo(preset: PeriodoPreset | string | undefined): {
  inicio: Date;
  fim: Date;
  preset: PeriodoPreset;
} {
  const hoje = new Date();
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate(), 23, 59, 59));
  const resolved: PeriodoPreset = (
    ["mes-atual", "3-meses", "6-meses", "ano-atual"] as const
  ).includes(preset as PeriodoPreset)
    ? (preset as PeriodoPreset)
    : "6-meses";

  let inicio: Date;
  switch (resolved) {
    case "mes-atual":
      inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
      break;
    case "3-meses":
      inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 2, 1));
      break;
    case "ano-atual":
      inicio = new Date(Date.UTC(hoje.getUTCFullYear(), 0, 1));
      break;
    case "6-meses":
    default:
      inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 5, 1));
      break;
  }

  return { inicio, fim, preset: resolved };
}
