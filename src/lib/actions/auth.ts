"use server";

import { randomBytes, createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionCookie, deleteSessionCookie } from "@/lib/auth/session";
import { requireUsuario } from "@/lib/auth/dal";
import { logAudit } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/resend";
import {
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  type LoginState,
  type ForgotPasswordState,
  type ResetPasswordState,
} from "@/lib/validation/auth";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const validated = LoginSchema.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, senha } = validated.data;

  const usuario = await db.usuario.findUnique({ where: { email } });

  if (!usuario || !usuario.ativo || !(await verifyPassword(senha, usuario.senhaHash))) {
    return { message: "E-mail/usuário ou senha inválidos." };
  }

  await createSessionCookie({
    usuarioId: usuario.id,
    role: usuario.role,
    fazendaId: usuario.fazendaId,
    sv: usuario.sessionVersion,
  });

  await logAudit({
    fazendaId: usuario.fazendaId,
    usuarioId: usuario.id,
    acao: "LOGIN",
  });

  redirect(usuario.role === "ADMIN" ? "/admin" : "/dashboard");
}

export async function logout() {
  const usuario = await requireUsuario().catch(() => null);
  if (usuario) {
    await logAudit({ fazendaId: usuario.fazendaId, usuarioId: usuario.id, acao: "LOGOUT" });
  }
  await deleteSessionCookie();
  redirect("/login");
}

export async function requestPasswordReset(
  _state: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const validated = ForgotPasswordSchema.safeParse({ email: formData.get("email") });

  const generic = {
    success: true,
    message: "Se o e-mail existir na nossa base, você vai receber um link de redefinição em instantes.",
  };

  if (!validated.success) return generic;

  const usuario = await db.usuario.findUnique({ where: { email: validated.data.email } });
  if (!usuario || !usuario.ativo) return generic;

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  await db.passwordResetToken.create({
    data: {
      usuarioId: usuario.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${process.env.APP_URL}/redefinir-senha/${rawToken}`;

  await sendEmail({
    to: usuario.email,
    subject: "AGROcore — Redefinição de senha",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#3f6b3f;">Redefinir senha</h2>
        <p>Recebemos um pedido para redefinir a senha da sua conta AGROcore.</p>
        <p><a href="${resetUrl}" style="background:#3f6b3f;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Redefinir senha</a></p>
        <p>Esse link expira em 1 hora. Se você não pediu essa redefinição, ignore este e-mail.</p>
      </div>
    `,
  });

  await logAudit({ usuarioId: usuario.id, acao: "PASSWORD_RESET_REQUEST" });

  return generic;
}

export async function resetPassword(
  _state: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const validated = ResetPasswordSchema.safeParse({
    token: formData.get("token"),
    senha: formData.get("senha"),
    confirmarSenha: formData.get("confirmarSenha"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const tokenHash = createHash("sha256").update(validated.data.token).digest("hex");

  const resetToken = await db.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { message: "Link inválido ou expirado. Solicite uma nova redefinição de senha." };
  }

  const senhaHash = await hashPassword(validated.data.senha);

  await db.$transaction([
    db.usuario.update({
      where: { id: resetToken.usuarioId },
      data: { senhaHash, sessionVersion: { increment: 1 } },
    }),
    db.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await logAudit({ usuarioId: resetToken.usuarioId, acao: "PASSWORD_RESET_COMPLETE" });

  return { success: true, message: "Senha redefinida com sucesso. Você já pode fazer login." };
}
