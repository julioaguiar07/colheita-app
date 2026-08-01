import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";

export const metadata: Metadata = { title: "Esqueci minha senha — AGROcore" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
