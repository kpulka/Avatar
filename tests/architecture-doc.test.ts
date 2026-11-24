/**
 * Doc-sync gate for ARCHITECTURE.md (14-05, ARCH-04 / ARCH-08): the parts of the document that
 * restate data the code already owns must agree with it, so the doc cannot silently drift.
 *
 *  - the layer table equals LAYER_MAY_IMPORT (tests/layering-rules.ts, the data the layering gate enforces),
 *  - the event catalog lists exactly the AppEvents keys, and its producer / consumer files are
 *    exactly the files that call emit(...) / on(...) for that event,
 *  - every `path` or `path:line` citation points at a file that exists (and a line that exists).
 *
 * Line numbers inside the catalog are deliberately NOT asserted: they are evidence at the
 * verification date, and a test that failed on every unrelated edit would train people to ignore it.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LAYER_MAY_IMPORT, LAYER_ORDER } from './layering-rules';
import { defined } from './helpers/defined';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DOC = readFileSync(join(ROOT, 'ARCHITECTURE.md'), 'utf8');

function between(text: string, start: string, end: string): string {
  const from = text.indexOf(start);
  const to = text.indexOf(end);
  expect(from, `marker ${start}`).toBeGreaterThanOrEqual(0);
  expect(to, `marker ${end}`).toBeGreaterThan(from);
  return text.slice(from + start.length, to);
}

function tableRows(block: string): string[][] {
  return block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('|') && !/^\|[-| ]+\|$/.test(line))
    .slice(1) // header row
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())
    );
}

const backticked = (cell: string): string[] => [...cell.matchAll(/`([^`]+)`/g)].map((m) => defined(m[1]));

function walkTs(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const child = join(dir, name);
    return statSync(child).isDirectory() ? walkTs(child) : child.endsWith('.ts') ? [child] : [];
  });
}

const SRC_FILES = walkTs(join(ROOT, 'src')).map((f) => f.slice(ROOT.length).replace(/\\/g, '/'));

/** `captions.ts` or `types/avatar.ts` -> the single src file it names. */
function resolveSrc(name: string): string {
  const matches = SRC_FILES.filter((f) => f === `src/${name}` || f.endsWith(`/${name}`));
  expect(matches, `ARCHITECTURE.md names "${name}"; it must match exactly one file under src/`).toHaveLength(1);
  return defined(matches[0]);
}

describe('ARCHITECTURE.md is in sync with the code (14-05)', () => {
  it('layer table matches the layering contract (LAYER_MAY_IMPORT)', () => {
    const rows = tableRows(between(DOC, '<!-- layer-table:start -->', '<!-- layer-table:end -->'));
    const documented = new Map(rows.map((cells) => [backticked(defined(cells[0]))[0] ?? '', cells]));
    expect([...documented.keys()].sort()).toEqual([...LAYER_ORDER].sort());
    for (const layer of LAYER_ORDER) {
      const mayImportCell = defined(documented.get(layer)?.[2], `row for ${layer}`);
      const listed = mayImportCell === 'nothing' ? [] : backticked(mayImportCell);
      expect([...listed].sort(), `May import of ${layer}`).toEqual([...LAYER_MAY_IMPORT[layer]].sort());
    }
  });

  it('event catalog lists exactly the AppEvents keys, with their real producer and consumer files', () => {
    const appTypes = readFileSync(join(ROOT, 'src/app/app-types.ts'), 'utf8');
    const block = defined(/export interface AppEvents[^{]*\{([\s\S]*?)\n\}/.exec(appTypes)?.[1], 'AppEvents block');
    const keys = [...block.matchAll(/^\s*'([a-z0-9:]+)':/gm)].map((m) => defined(m[1]));
    expect(keys.length).toBeGreaterThan(10);

    const rows = tableRows(between(DOC, '<!-- event-catalog:start -->', '<!-- event-catalog:end -->'));
    const events = rows.map((cells) => backticked(defined(cells[0]))[0] ?? '');
    expect([...events].sort()).toEqual([...keys].sort());

    const files = SRC_FILES.filter((f) => f !== 'src/app/events.ts' && f !== 'src/prod/embed-bridge.ts');
    const text = new Map(files.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]));
    const filesCalling = (verb: 'emit' | 'on', event: string): string[] =>
      files.filter((f) => new RegExp(`\\.${verb}\\(\\s*'${event}'`).test(defined(text.get(f)))).sort();
    const cited = (cell: string): string[] =>
      [
        ...new Set(
          backticked(cell)
            .map((token) => token.replace(/:.*$/, ''))
            .filter((n) => n.endsWith('.ts'))
            .map(resolveSrc)
        ),
      ].sort();

    for (const cells of rows) {
      const event = defined(backticked(defined(cells[0]))[0]);
      // payload cell: any cited file must exist
      for (const token of backticked(defined(cells[1]))) {
        if (token.endsWith('.ts') || /\.ts:\d+$/.test(token)) resolveSrc(token.replace(/:.*$/, ''));
      }
      expect(cited(defined(cells[2])), `producers of ${event}`).toEqual(filesCalling('emit', event));
      expect(cited(defined(cells[3])), `consumers of ${event}`).toEqual(filesCalling('on', event));
    }
  });

  it('every cited file exists and every cited line is within the file', () => {
    const citation =
      /`((?:src|tests|docs|public|a2f)\/[\w./-]+\.[a-z0-9]+|vite\.config\.ts|tsconfig[\w.]*\.json|package\.json)(?::(\d+)(?:-:?(\d+))?)?`/g;
    const problems: string[] = [];
    let count = 0;
    for (const match of DOC.matchAll(citation)) {
      count += 1;
      const file = defined(match[1]);
      const abs = join(ROOT, file);
      if (!existsSync(abs)) {
        problems.push(`${file}: file does not exist`);
        continue;
      }
      const lineCount = readFileSync(abs, 'utf8').split(/\r?\n/).length;
      for (const n of [match[2], match[3]]) {
        if (n !== undefined && Number(n) > lineCount) problems.push(`${file}:${n}: file has only ${lineCount} lines`);
      }
    }
    expect(count).toBeGreaterThan(30);
    expect(problems).toEqual([]);
  });

  it('is linked from README and the planning index', () => {
    expect(readFileSync(join(ROOT, 'README.md'), 'utf8')).toContain('(ARCHITECTURE.md)');
    expect(readFileSync(join(ROOT, '.planning/README.md'), 'utf8')).toContain('(../ARCHITECTURE.md)');
    expect(posix.basename('ARCHITECTURE.md')).toBe('ARCHITECTURE.md');
  });
});
