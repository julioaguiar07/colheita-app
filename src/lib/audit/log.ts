import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function logAudit(params: {
  fazendaId?: string | null;
  usuarioId?: number | null;
  acao: string;
  entidade?: string;
  entidadeId?: string;
  detalhes?: Prisma.InputJsonValue;
}) {
  await db.auditLog.create({
    data: {
      fazendaId: params.fazendaId ?? null,
      usuarioId: params.usuarioId ?? null,
      acao: params.acao,
      entidade: params.entidade ?? null,
      entidadeId: params.entidadeId ?? null,
      detalhesJson: params.detalhes ?? undefined,
    },
  });
}
