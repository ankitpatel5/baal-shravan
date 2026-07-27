import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AppUtils = require('../utils.js');
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const APP_SRC = readFileSync(join(ROOT, 'app.js'), 'utf8');

// ── Practice Tracing: pure helpers ──────────────────────────────────────────

describe('traceThreshold', () => {
  it('plain consonants complete at 85%', () => {
    expect(AppUtils.traceThreshold('ક')).toBe(0.85);
    expect(AppUtils.traceThreshold('ળ')).toBe(0.85);
  });
  it('conjuncts (virama) complete at 80% — dense junctions', () => {
    expect(AppUtils.traceThreshold('ક્ષ')).toBe(0.80);
    expect(AppUtils.traceThreshold('જ્ઞ')).toBe(0.80);
  });
});

describe('traceNextUntraced', () => {
  it('returns the next untraced index after cur', () => {
    expect(AppUtils.traceNextUntraced([0, 1], 5, 1)).toBe(2);
  });
  it('skips traced letters', () => {
    expect(AppUtils.traceNextUntraced([0, 2, 3], 5, 1)).toBe(4);
  });
  it('wraps past the end', () => {
    expect(AppUtils.traceNextUntraced([3, 4], 5, 4)).toBe(0);
  });
  it('-1 when everything is traced', () => {
    expect(AppUtils.traceNextUntraced([0, 1, 2], 3, 1)).toBe(-1);
  });
  it('handles missing progress array', () => {
    expect(AppUtils.traceNextUntraced(undefined, 3, 0)).toBe(1);
  });
});

describe('largestUnpaintedCluster', () => {
  it('finds the centroid of the bigger unpainted cluster', () => {
    // two clusters: 3 points near (10,10), 1 point at (200,200)
    const samples = [
      { x: 8, y: 8 }, { x: 12, y: 10 }, { x: 10, y: 14 },
      { x: 200, y: 200 },
      { x: 100, y: 100 },   // painted — excluded
    ];
    const painted = [false, false, false, false, true];
    const c = AppUtils.largestUnpaintedCluster(samples, painted, 24);
    expect(c.count).toBe(3);
    expect(c.x).toBeCloseTo(10, 0);
    expect(c.y).toBeCloseTo(10.67, 0);
  });
  it('null when everything is painted', () => {
    expect(AppUtils.largestUnpaintedCluster([{ x: 1, y: 1 }], [true])).toBeNull();
  });
  it('merges adjacent grid cells into one cluster', () => {
    // straddles two neighbouring 24px cells → still one cluster of 4
    const samples = [{ x: 20, y: 10 }, { x: 28, y: 10 }, { x: 44, y: 10 }, { x: 52, y: 10 }];
    const c = AppUtils.largestUnpaintedCluster(samples, [false, false, false, false], 24);
    expect(c.count).toBe(4);
  });
});

// ── Wiring locks (source-level, the audio-focus test precedent) ─────────────

describe('Practice Tracing wiring', () => {
  it('trace stage is excluded from swipe-back (crossbar strokes must paint, not navigate)', () => {
    const fn = APP_SRC.slice(APP_SRC.indexOf('function setupSwipeBack'));
    const m = fn.match(/e\.target\.closest\('([^']*)'\)\) return;/);
    expect(m, 'swipe-back exclusion selector present').toBeTruthy();
    expect(m[1]).toContain('#guj-trace-stage');
  });
  it('trace view rides the hardware-back map', () => {
    expect(APP_SRC).toMatch(/'view-gujarati-trace':\s*'guj-trace-back'/);
  });
  it("done is EARNED: markGujDone('tracing', …) fires exactly once, in the completion path", () => {
    const marks = APP_SRC.match(/markGujDone\('tracing'/g) || [];
    expect(marks.length).toBe(1);
    // and it must NOT be in openGujTrace (mark-on-open would cheapen the ring)
    const openFn = APP_SRC.slice(APP_SRC.indexOf('function openGujTrace'), APP_SRC.indexOf('function gujTraceBoot'));
    expect(openFn).not.toContain("markGujDone");
  });
  it('tracing hub entry points at the consonants data via dataKey', () => {
    expect(APP_SRC).toMatch(/tracing:\s*\{[^}]*dataKey:\s*'consonants'/);
  });
  it('trace stage stops page scroll (touch-action none in CSS)', () => {
    const css = readFileSync(join(ROOT, 'styles.css'), 'utf8');
    const block = css.slice(css.indexOf('#guj-trace-stage'), css.indexOf('#guj-trace-canvas'));
    expect(block).toContain('touch-action: none');
  });
});
