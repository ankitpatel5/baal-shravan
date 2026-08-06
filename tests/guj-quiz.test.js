import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AppUtils = require('../utils.js');
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const APP_SRC = readFileSync(join(ROOT, 'app.js'), 'utf8');

// deterministic rng for reproducible shuffles
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x80000000;
  };
}

describe('shuffleIndices', () => {
  it('returns a permutation of 0..n-1', () => {
    const a = AppUtils.shuffleIndices(34);
    expect(a.length).toBe(34);
    expect([...a].sort((x, y) => x - y)).toEqual(Array.from({ length: 34 }, (_, i) => i));
  });
  it('is deterministic with an injected rng', () => {
    expect(AppUtils.shuffleIndices(10, seeded(42))).toEqual(AppUtils.shuffleIndices(10, seeded(42)));
  });
});

describe('quizOptions', () => {
  const items = [
    { translit: 'ka' }, { translit: 'kha' }, { translit: 'ga' }, { translit: 'gha' },
    { translit: 'cha' }, { translit: 'chha' }, { translit: 'ja' }, { translit: 'jha' },
  ];
  it('returns 4 unique option indices including the correct one', () => {
    const opts = AppUtils.quizOptions(items, 2, seeded(7));
    expect(opts.length).toBe(4);
    expect(new Set(opts).size).toBe(4);
    expect(opts).toContain(2);
  });
  it('never duplicates a transliteration (kakko has repeats)', () => {
    const dup = [
      { translit: 'sa' }, { translit: 'sha' }, { translit: 'sa' },   // real repeat
      { translit: 'ha' }, { translit: 'la' }, { translit: 'ra' },
    ];
    for (let seed = 1; seed < 20; seed++) {
      const opts = AppUtils.quizOptions(dup, 0, seeded(seed));
      const translits = opts.map((i) => dup[i].translit);
      expect(new Set(translits).size).toBe(translits.length);
    }
  });
  it('is deterministic with an injected rng', () => {
    expect(AppUtils.quizOptions(items, 5, seeded(3))).toEqual(AppUtils.quizOptions(items, 5, seeded(3)));
  });
});

describe('Quiz wiring', () => {
  it('quiz hub entry rides the consonants data via dataKey', () => {
    expect(APP_SRC).toMatch(/quiz:\s*\{[^}]*dataKey:\s*'consonants'/);
  });
  it('one attempt per question: the first tap flips _quizAnswered', () => {
    const fn = APP_SRC.slice(APP_SRC.indexOf('function gujQuizRender'), APP_SRC.indexOf('function gujQuizSummary'));
    expect(fn).toContain('if (_quizAnswered) return');
    expect(fn).toContain('_quizAnswered = true');
  });
  it('a wrong pick still reveals the correct answer', () => {
    const fn = APP_SRC.slice(APP_SRC.indexOf('function gujQuizRender'), APP_SRC.indexOf('function gujQuizSummary'));
    expect(fn).toMatch(/always reveal the answer/);
  });
  it("the ring is earned: markGujDone('quiz') fires only on a right answer, once in the source", () => {
    const marks = APP_SRC.match(/markGujDone\('quiz'/g) || [];
    expect(marks.length).toBe(1);
    const fn = APP_SRC.slice(APP_SRC.indexOf('function gujQuizRender'), APP_SRC.indexOf('function gujQuizSummary'));
    const rightBranch = fn.slice(fn.indexOf('if (right)'), fn.indexOf('} else {'));
    expect(rightBranch).toContain("markGujDone('quiz'");
  });
  it('the summary reports right vs missed', () => {
    const fn = APP_SRC.slice(APP_SRC.indexOf('function gujQuizSummary'), APP_SRC.indexOf('function detailHeader'));
    expect(fn).toContain('guj-quiz-score-right');
    expect(fn).toContain('guj-quiz-score-wrong');
  });
});
