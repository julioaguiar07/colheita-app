import "server-only";
import { Resend } from "resend";

const FROM_ADDRESS = "AGROcore <onboarding@resend.dev>";

export async function sendEmail(params: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY não configurada — e-mail não enviado.`);
    console.log(`[email] Para: ${params.to} | Assunto: ${params.subject}`);
    console.log(params.html);
    return { simulated: true };
  }

  const resend = new Resend(apiKey);
  return resend.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}
