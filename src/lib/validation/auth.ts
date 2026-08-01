import * as z from "zod";

export const LoginSchema = z.object({
  email: z.string().min(1, { error: "Informe seu e-mail ou usuário." }),
  senha: z.string().min(1, { error: "Informe sua senha." }),
});

export const ForgotPasswordSchema = z.object({
  email: z.email({ error: "Informe um e-mail válido." }),
});

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1),
    senha: z.string().min(8, { error: "A senha deve ter pelo menos 8 caracteres." }),
    confirmarSenha: z.string().min(1),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    error: "As senhas não coincidem.",
    path: ["confirmarSenha"],
  });

export type LoginState =
  | { errors?: { email?: string[]; senha?: string[] }; message?: string }
  | undefined;

export type ForgotPasswordState = { message?: string; success?: boolean } | undefined;

export type ResetPasswordState =
  | { errors?: { senha?: string[]; confirmarSenha?: string[] }; message?: string; success?: boolean }
  | undefined;
