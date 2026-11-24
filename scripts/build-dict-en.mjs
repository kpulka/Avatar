#!/usr/bin/env node
/**
 * Builds the pruned English G2P lexicon: src/lipsync/g2p/dict-en-pruned.json (Phase 17, 17-01).
 *
 * WHY: the full CMU pronouncing dictionary (135k entries) shipped to the browser as a 3.92 MB
 * (961 kB gzip) chunk plus ~290 ms of main-thread parsing, for a talking head whose speech is
 * conversational English. The runtime now loads this committed artifact instead; the full
 * dictionary stays a devDependency used only here.
 *
 * SELECTION (deterministic, no network): words are ranked by three tiers and the first N kept.
 *   1. Core vocabulary: scripts/data/en-core-vocabulary.txt (hand-curated base forms) plus their
 *      regular inflections/derivations that exist in CMUdict, plus contractions of those words.
 *   2. Prose frequency: scripts/data/en-prose-frequency.txt (see scripts/build-word-frequency.mjs).
 *   3. Remaining plain words, shortest first, then alphabetical.
 * The evaluation corpus (scripts/lipsync-corpus.mjs) is deliberately NOT an input of the
 * selection: it only measures the result. Feeding it in would make the gate a tautology.
 *
 * DECISION GATE: for N in {5k, 10k, 20k, 50k, full} the script prints the token hit-rate on
 * the corpus (control sentences + conversational paragraphs), and the raw / gzip(9) size of the
 * artifact. It then writes the SMALLEST N whose hit-rate is >= 95%. Expected: 10,000. If 10k
 * misses the gate the script moves on to 20k by itself; it never lowers the threshold.
 *
 * IDEMPOTENT: no timestamps, sorted keys, fixed formatting. Running it twice yields a
 * byte-identical file (checked with `git diff --exit-code`).
 *
 * WHEN TO RE-RUN: vocabulary-drift complaints (a common word degrading to letter rules), a
 * cmu-pronouncing-dictionary upgrade, or edits to the core vocabulary / corpus files.
 *
 * Usage: npm run build:dict            (gate picks N)
 *        node scripts/build-dict-en.mjs --n=20000   (force N, still prints the table)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dictionary } from 'cmu-pronouncing-dictionary';
import { GATE_TOKENS } from './lipsync-corpus.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'lipsync', 'g2p', 'dict-en-pruned.json');
const GATE = 0.95;
const CANDIDATES = [5000, 10000, 20000, 50000];

const readLines = (rel) => readFileSync(join(ROOT, rel), 'utf8').split(/\r?\n/);

// ---- source dictionary: base entries only ("word(2)" alternates never match a lookup) --------
const baseKeys = Object.keys(dictionary).filter((key) => !/\(\d+\)$/.test(key));
const inCmu = new Set(baseKeys);

// ---- tier 1: core vocabulary + morphological closure ------------------------------------------
const seed = readLines('scripts/data/en-core-vocabulary.txt')
  .filter((line) => !line.startsWith('#'))
  .join(' ')
  .split(/\s+/)
  .filter(Boolean);
const seedSet = new Set(seed);

const isVowel = (c) => 'aeiou'.includes(c);

/** Candidate surface forms of a base word with a priority (lower = more common). */
function derivedForms(base) {
  const out = [[base, 0]];
  const last = base[base.length - 1];
  out.push([base + 's', 1], [base + 'es', 1], [base + 'ed', 2], [base + 'd', 2], [base + 'ing', 2]);
  out.push([base + 'er', 3], [base + 'est', 3], [base + 'ly', 3], [base + 'ers', 3]);
  out.push([base + 'ness', 4], [base + 'ment', 4], [base + 'ments', 4], [base + 'ful', 4], [base + 'less', 4]);
  out.push([base + 'able', 4], [base + 'ity', 4], [base + 'tion', 4], [base + 'al', 4], [base + 'y', 4]);
  if (last === 'e') {
    const stem = base.slice(0, -1);
    out.push([stem + 'ing', 2], [stem + 'ation', 4], [stem + 'able', 4], [stem + 'ive', 4]);
  }
  if (last === 'y') {
    const stem = base.slice(0, -1);
    out.push([stem + 'ies', 1], [stem + 'ied', 2], [stem + 'ier', 3], [stem + 'iest', 3], [stem + 'ily', 3], [stem + 'iness', 4]);
  }
  if (base.length >= 2 && !isVowel(last) && isVowel(base[base.length - 2]) && !'wxy'.includes(last)) {
    out.push([base + last + 'ed', 2], [base + last + 'ing', 2], [base + last + 'er', 3], [base + last + 'est', 3]);
  }
  return out;
}

const tier1Priority = new Map();
for (const base of seedSet) {
  for (const [form, priority] of derivedForms(base)) {
    if (inCmu.has(form) && priority < (tier1Priority.get(form) ?? Infinity)) tier1Priority.set(form, priority);
  }
}
// Contractions ("don't", "it's", "i'm") whose stem is a tier-1 word.
for (const key of baseKeys) {
  const apostrophe = key.indexOf("'");
  if (apostrophe <= 0) continue;
  const stem = key.slice(0, apostrophe);
  const stems = key.slice(apostrophe) === "'t" && stem.endsWith('n') ? [stem, stem.slice(0, -1)] : [stem];
  if (stems.some((s) => tier1Priority.has(s)) && !tier1Priority.has(key)) tier1Priority.set(key, 1);
}
const tier1 = [...tier1Priority.keys()].sort(
  (a, b) => tier1Priority.get(a) - tier1Priority.get(b) || a.length - b.length || (a < b ? -1 : 1),
);

// ---- tier 2: prose frequency ------------------------------------------------------------------
const tier2 = readLines('scripts/data/en-prose-frequency.txt')
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split(' ')[0])
  .filter((word) => inCmu.has(word));

// ---- tier 3: everything else, plain words by length, then the rest alphabetically -------------
const ranked = [];
const taken = new Set();
const take = (word) => {
  if (!taken.has(word)) {
    taken.add(word);
    ranked.push(word);
  }
};
tier1.forEach(take);
tier2.forEach(take);
baseKeys
  .filter((word) => /^[a-z]+$/.test(word) && !taken.has(word))
  .sort((a, b) => a.length - b.length || (a < b ? -1 : 1))
  .forEach(take);
baseKeys.filter((word) => !taken.has(word)).sort().forEach(take);

// ---- artifact serialization -------------------------------------------------------------------
const stripStress = (pronunciation) => pronunciation.replace(/[0-2]/g, '');

function serialize(words) {
  const sorted = [...words].sort();
  const cmuVersion = JSON.parse(
    readFileSync(join(ROOT, 'node_modules', 'cmu-pronouncing-dictionary', 'package.json'), 'utf8'),
  ).version;
  const meta = {
    source: 'cmu-pronouncing-dictionary',
    sourceVersion: cmuVersion,
    entries: sorted.length,
    stress: 'stripped',
    selection: 'core vocabulary + inflections, prose frequency, word length (scripts/build-dict-en.mjs)',
  };
  const lines = sorted.map((word) => `${JSON.stringify(word)}:${JSON.stringify(stripStress(dictionary[word]))}`);
  return `{"meta":${JSON.stringify(meta)},\n"entries":{\n${lines.join(',\n')}\n}}\n`;
}

// ---- measurement -------------------------------------------------------------------------------
/** Same lookup ladder as wordInLexicon() in g2p-en.ts: direct, apostrophes removed, hyphen parts. */
function inLexicon(set, token) {
  if (set.has(token)) return true;
  if (/['’]/.test(token) && set.has(token.replace(/['’]/g, ''))) return true;
  if (token.includes('-')) return token.split('-').every((part) => set.has(part));
  return false;
}

const forcedN = process.argv.find((arg) => arg.startsWith('--n='));
const sizes = [...CANDIDATES, ranked.length];
const rows = [];
let chosen = null;
for (const n of sizes) {
  const words = ranked.slice(0, n);
  const set = new Set(words);
  const hits = GATE_TOKENS.filter((token) => inLexicon(set, token)).length;
  const rate = hits / GATE_TOKENS.length;
  const json = serialize(words);
  const gzip = gzipSync(Buffer.from(json), { level: 9 }).length;
  rows.push({ n: words.length, rate, raw: Buffer.byteLength(json), gzip });
  if (chosen === null && rate >= GATE && n !== ranked.length) chosen = n;
}

console.log(`corpus: ${GATE_TOKENS.length} tokens (control + conversational), gate >= ${GATE * 100}%`);
console.log('N        hit-rate   raw (kB)   gzip-9 (kB)');
for (const row of rows) {
  console.log(
    `${String(row.n).padEnd(8)} ${(row.rate * 100).toFixed(1).padStart(6)}%   ${(row.raw / 1000).toFixed(1).padStart(8)}   ${(row.gzip / 1000).toFixed(1).padStart(8)}`,
  );
}

const finalN = forcedN ? Number(forcedN.slice('--n='.length)) : (chosen ?? ranked.length);
const finalWords = ranked.slice(0, finalN);
writeFileSync(OUT, serialize(finalWords));
console.log(`gate pick: N=${chosen ?? 'none (full dictionary)'}; wrote ${finalWords.length} entries to src/lipsync/g2p/dict-en-pruned.json`);
