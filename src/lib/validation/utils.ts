import type * as z from "zod";

export function flattenFieldErrors(error: z.ZodError): Record<string, string[]> {
  const { fieldErrors } = error.flatten();
  const errors: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(fieldErrors)) {
    if (value) errors[key] = value as string[];
  }
  return errors;
}
