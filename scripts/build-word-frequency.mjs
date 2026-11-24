#!/usr/bin/env node
/**
 * Derives scripts/data/en-prose-frequency.txt: a word-frequency ranking measured on the English
 * prose that ships inside the project's own dependency tree (README / docs markdown plus the
 * doc comments of the .d.ts files). Phase 17, plan 17-01.
 *
 * WHY this exists: cmu-pronouncing-dictionary is alphabetical and has no frequency data, and
 * the lexicon pruning (scripts/build-dict-en.mjs) must NOT be tuned on the evaluation corpus
 * (that would make the hit-rate gate a tautology). This file is an independent, measurable
 * frequency signal that needs no network and no extra dependency.
 *
 * LIMITS (documented honestly): the prose is technical, so it is a weak proxy for spoken
 * conversation; the curated core vocabulary (scripts/data/en-core-vocabulary.txt) carries the
 * everyday words and this ranking only orders the long tail after it.
 *
 * The OUTPUT is committed. This script is a one-off regeneration tool, not part of the build,
 * because node_modules content can differ slightly between platforms (for example platform
 * specific optional packages) and the committed file is what makes build:dict reproducible.
 * Re-run it only when the ranking itself needs to be refreshed.
 *
 * Usage: node scripts/build-word-frequency.mjs
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dictionary } from 'cmu-pronouncing-dictionary';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'scripts', 'data', 'en-prose-frequency.txt');
const MIN_COUNT = 2;

function walk(dir, out) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const files = walk(join(ROOT, 'node_modules'), []);
const counts = new Map();
const addText = (text) => {
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
};

for (const file of files) {
  if (/\.(md|txt)$/i.test(file) && !/licen[sc]e/i.test(file)) {
    addText(readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, ' '));
  } else if (/\.d\.ts$/.test(file)) {
    const comments = readFileSync(file, 'utf8').match(/\/\*\*[\s\S]*?\*\//g) ?? [];
    addText(comments.join(' ').replace(/^\s*\*+/gm, ' '));
  }
}

// Keep only plain alphabetic CMU base keys: that is all the pruning script can use.
const ranked = Object.keys(dictionary)
  .filter((key) => /^[a-z]+$/.test(key) && (counts.get(key) ?? 0) >= MIN_COUNT)
  .sort((a, b) => counts.get(b) - counts.get(a) || (a < b ? -1 : 1));

const header = [
  '# English prose word frequency (word<space>count), most frequent first.',
  '# Derived by scripts/build-word-frequency.mjs from README/docs markdown and .d.ts doc comments',
  '# in node_modules; only plain alphabetic words present in CMUdict with count >= ' + MIN_COUNT + '.',
  '# Consumed by scripts/build-dict-en.mjs as the tail ranking after the core vocabulary.',
];
writeFileSync(OUT, header.concat(ranked.map((w) => `${w} ${counts.get(w)}`)).join('\n') + '\n');
console.log(`wrote ${ranked.length} words to ${OUT}`);
