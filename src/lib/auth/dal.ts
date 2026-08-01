import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import { Role } from "@/generated/prisma/enums";

export interface UsuarioAtual {
  id: number;
  email: string;
  nome: string | null;
  role: Role;
  fazendaId: string | null;
  fazendaNome: string | null;
}

/**
 * Authoritative session check: verifies the JWT and compares its session version
 * against the live DB value, so a password reset (which bumps sessionVersion)
 * immediately invalidates every other active session.
 */
export const verifySession = cache(async (): Promise<UsuarioAtual | null> => {
  const payload = await getSessionFromCookies();
  if (!payload) return null;

  const usuario = await db.usuario.findUnique({
    where: { id: payload.usuarioId },
    select: {
      id: true,
      email: true,
      nome: true,
      role: true,
      ativo: true,
      sessionVersion: true,
      fazendaId: true,
      fazenda: { select: { nome: true } },
    },
  });

  if (!usuario || !usuario.ativo || usuario.sessionVersion !== payload.sv) return null;

  return {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    role: usuario.role,
    fazendaId: usuario.fazendaId,
    fazendaNome: usuario.fazenda?.nome ?? null,
  };
});

/** Use in Server Components / Server Actions that require a logged-in user; redirects otherwise. */
export async function requireUsuario(): Promise<UsuarioAtual> {
  const usuario = await verifySession();
  if (!usuario) redirect("/login");
  return usuario;
}

/** Use where a MEMBRO (farm member) with an assigned Fazenda is required. */
export async function requireFazenda(): Promise<UsuarioAtual & { fazendaId: string }> {
  const usuario = await requireUsuario();
  if (!usuario.fazendaId) redirect(usuario.role === Role.ADMIN ? "/admin" : "/login");
  return usuario as UsuarioAtual & { fazendaId: string };
}

/** Use where a platform ADMIN is required. */
export async function requireAdmin(): Promise<UsuarioAtual> {
  const usuario = await requireUsuario();
  if (usuario.role !== Role.ADMIN) redirect("/dashboard");
  return usuario;
}
