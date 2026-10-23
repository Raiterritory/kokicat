// Códigos secretos: desbloquean personajes sin gastar pastelitos.
// Se escriben en Personajes → "🔑 Código secreto" (ver src/routes/index.tsx).
import { CHARACTERS, type Character } from "./characters";

/** Deja el código comparable: minúsculas, sin tildes y con un solo espacio entre palabras. */
export function normalizeCode(code: string): string {
  return code
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Personajes que abre un código (lista vacía si el código no existe). */
export function charactersForCode(code: string): Character[] {
  const key = normalizeCode(code);
  if (!key) return [];
  return CHARACTERS.filter((c) => c.code && normalizeCode(c.code) === key);
}
