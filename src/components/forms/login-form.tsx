"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { login } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">Entrar</h2>
        <p className="text-sm text-muted-foreground">Acesse o painel da sua fazenda.</p>
      </div>

      <FieldGroup>
        <Field data-invalid={!!state?.errors?.email}>
          <FieldLabel htmlFor="email">E-mail ou usuário</FieldLabel>
          <Input id="email" name="email" autoComplete="username" placeholder="seu@email.com" />
          <FieldError errors={state?.errors?.email?.map((message) => ({ message }))} />
        </Field>

        <Field data-invalid={!!state?.errors?.senha}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="senha">Senha</FieldLabel>
            <Link href="/esqueci-senha" className="text-xs text-primary underline-offset-4 hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <Input id="senha" name="senha" type="password" autoComplete="current-password" />
          <FieldError errors={state?.errors?.senha?.map((message) => ({ message }))} />
        </Field>
      </FieldGroup>

      {state?.message && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Entrar
      </Button>
    </form>
  );
}
