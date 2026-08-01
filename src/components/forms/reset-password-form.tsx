"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { resetPassword } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);

  if (state?.success) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Senha redefinida</h2>
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <Button className="w-full" render={<Link href="/login" />}>
          Ir para o login
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">Redefinir senha</h2>
        <p className="text-sm text-muted-foreground">Escolha uma nova senha para sua conta.</p>
      </div>

      <FieldGroup>
        <Field data-invalid={!!state?.errors?.senha}>
          <FieldLabel htmlFor="senha">Nova senha</FieldLabel>
          <Input id="senha" name="senha" type="password" autoComplete="new-password" />
          <FieldError errors={state?.errors?.senha?.map((message) => ({ message }))} />
        </Field>

        <Field data-invalid={!!state?.errors?.confirmarSenha}>
          <FieldLabel htmlFor="confirmarSenha">Confirmar nova senha</FieldLabel>
          <Input id="confirmarSenha" name="confirmarSenha" type="password" autoComplete="new-password" />
          <FieldError errors={state?.errors?.confirmarSenha?.map((message) => ({ message }))} />
        </Field>
      </FieldGroup>

      {state?.message && !state?.success && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Redefinir senha
      </Button>
    </form>
  );
}
