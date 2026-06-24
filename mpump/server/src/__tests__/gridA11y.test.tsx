/**
 * Grid accessibility (#5): step/drum/bass cells are exposed as toggle buttons
 * (role="button" + aria-pressed) with a roving tabindex (exactly one cell is
 * tab-focusable at a time). Rendered from the real StepGrid + useGridPointer.
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { StepData } from "../types";
import { StepGrid } from "../components/StepGrid";

function render() {
  const steps: (StepData | null)[] = Array.from({ length: 16 }, () => null);
  steps[0] = { semi: 0, vel: 1, slide: false }; // one filled step
  return renderToStaticMarkup(
    createElement(StepGrid, {
      steps,
      currentStep: -1,
      accent: "#66ff99",
      onTap: () => {},
      onEditStep: () => {},
    }),
  );
}

describe("StepGrid accessibility", () => {
  it("exposes cells as toggle buttons", () => {
    expect(render()).toMatch(/role="button"/);
  });

  it("reflects on/off state via aria-pressed", () => {
    const html = render();
    expect(html).toMatch(/aria-pressed="true"/); // the filled step
    expect(html).toMatch(/aria-pressed="false"/); // the empty steps
  });

  it("uses a roving tabindex — exactly one cell is tab-focusable", () => {
    const html = render();
    const focusable = html.match(/tabindex="0"/g) ?? [];
    expect(focusable.length).toBe(1);
  });
});
