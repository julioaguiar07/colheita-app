"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  if (state?.success) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Verifique seu e-mail</h2>
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft className="size-3.5" /> Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">Esqueci minha senha</h2>
        <p className="text-sm text-muted-foreground">
          Informe o e-mail da sua conta e enviaremos um link para redefinir a senha.
        </p>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="seu@email.com" />
        </Field>
      </FieldGroup>

      {state?.message && !state?.success && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Enviar link de redefinição
      </Button>

      <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Voltar para o login
      </Link>
    </form>
  );
}
