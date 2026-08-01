import bcrypt from "bcryptjs";

export async function hashPassword(senha: string) {
  return bcrypt.hash(senha, 10);
}

export async function verifyPassword(senha: string, hash: string) {
  return bcrypt.compare(senha, hash);
}
