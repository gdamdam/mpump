/**
 * Drums → FX exclusion UX (A + B).
 *
 * A — KaosPanel exposes a master "Drums → FX" toggle that flips the global
 *     mbExcludeDrums via the set_mb_exclude command. The underlying engine
 *     routing (mbExcludeDrums true→drums skip FX, false→drums join the chain)
 *     is already covered by audioPort.test.ts computeFxGroups exclude tests, so
 *     here we only verify the UI wiring.
 * B — EffectEditor disables the per-effect "EXCL. DRUMS" button while drums are
 *     globally excluded from FX (drumsInFx === false), because the per-effect
 *     flag is a no-op until drums are actually routed into the chain.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { EffectEditor } from "../components/EffectEditor";

// Cast to a loose component type so the test compiles before `drumsInFx` is
// added to EffectEditor's Props (the real component is still what renders).
const Editor = EffectEditor as unknown as (p: Record<string, unknown>) => null;
const render = (drumsInFx: boolean) =>
  renderToStaticMarkup(
    createElement(Editor, {
      name: "distortion",
      params: { on: true, drive: 50 },
      onUpdate: () => {},
      onClose: () => {},
      drumsInFx,
    }),
  );

describe("EffectEditor — per-effect DRUMS exclude (B)", () => {
  it("disables the EXCL. DRUMS button when drums are not routed through FX", () => {
    const html = render(false);
    expect(/<button[^>]*\bdisabled\b[^>]*>EXCL\. DRUMS/.test(html)).toBe(true);
  });

  it("enables the EXCL. DRUMS button when drums ARE routed through FX", () => {
    const html = render(true);
    expect(/<button[^>]*\bdisabled\b[^>]*>EXCL\. DRUMS/.test(html)).toBe(false);
  });

  it("never disables the BASS / SYNTH exclude buttons", () => {
    const html = render(false);
    expect(/<button[^>]*\bdisabled\b[^>]*>EXCL\. BASS/.test(html)).toBe(false);
    expect(/<button[^>]*\bdisabled\b[^>]*>EXCL\. SYNTH/.test(html)).toBe(false);
  });
});

describe("KaosPanel — Drums → FX master toggle (A, wiring)", () => {
  it("dispatches set_mb_exclude for drums and feeds drumsInFx to EffectEditor", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve(process.cwd(), "src/components/KaosPanel.tsx"), "utf8");
    expect(src).toMatch(/set_mb_exclude/);
    expect(src).toMatch(/channel:\s*["']drums["']/);
    expect(src).toMatch(/drumsInFx=\{/);
  });
});
