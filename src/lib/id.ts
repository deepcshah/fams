const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Short, collision-resistant-enough id for locally owned records. */
export function createId(prefix = 'p'): string {
  let out = '';
  for (let i = 0; i < 10; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}_${Date.now().toString(36)}${out}`;
}
