import type { Metadata } from "next";
import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = { title: "Entrar — AGROcore" };

export default function LoginPage() {
  return <LoginForm />;
}
