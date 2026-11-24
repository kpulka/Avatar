/**
 * Lip-sync engine selection (Phase 17-04). One id per language path:
 *  - 'phoneme-en': G2P phoneme path, English by default (CMUdict lexicon + letter rules)
 *  - 'phoneme-pl': G2P phoneme path, Polish by default (rule-based, no lexicon)
 *  - 'char': the character table (the fallback for every language)
 * Words carrying Polish evidence are routed to the Polish G2P by either phoneme engine (language.ts).
 */
export type LipSyncEngine = 'phoneme-en' | 'phoneme-pl' | 'char';

export const LIP_SYNC_ENGINES: readonly LipSyncEngine[] = ['phoneme-en', 'phoneme-pl', 'char'];

export const DEFAULT_LIP_SYNC_ENGINE: LipSyncEngine = 'phoneme-en';

/**
 * Normalizes any persisted / legacy value: the pre-17-04 value 'phoneme' means 'phoneme-en';
 * anything unknown yields undefined (the caller keeps its default).
 */
export function parseLipSyncEngine(value: unknown): LipSyncEngine | undefined {
  if (value === 'phoneme') return 'phoneme-en';
  return value === 'phoneme-en' || value === 'phoneme-pl' || value === 'char' ? value : undefined;
}
