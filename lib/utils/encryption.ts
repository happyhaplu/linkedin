import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function encryptData(data: string): string {
  // In production, use proper encryption like AES-256
  // For now, using base64 encoding (NOT secure for production)
  return Buffer.from(data).toString('base64')
}

export function decryptData(encrypted: string): string {
  // In production, use proper decryption
  return Buffer.from(encrypted, 'base64').toString('utf-8')
}
