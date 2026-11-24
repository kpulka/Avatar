// Type declarations for the plain-JS corpus module (scripts/lipsync-corpus.mjs), so the tests
// that import it are type-checked (npm run typecheck) instead of resolving to an implicit any.
export const CONTROL_SENTENCES: readonly string[];
export const CONVERSATIONAL_PARAGRAPHS: readonly string[];
export const OOV_SENTENCES: readonly string[];
export function tokenize(text: string): string[];
export const CORPUS_SENTENCES: readonly string[];
export const CORPUS_TOKENS: readonly string[];
export const GATE_TOKENS: readonly string[];
