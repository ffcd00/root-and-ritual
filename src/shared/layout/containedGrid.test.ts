import { describe, expect, it } from "vitest";

import { fitGridWithinRegion } from "./containedGrid";

describe("fitGridWithinRegion", () => {
  it("uses the limiting axis while preserving a board ratio", () => {
    expect(fitGridWithinRegion({ width: 600, height: 300 }, 5, 6)).toEqual({
      width: 360,
      height: 300,
    });
  });

  it("never exceeds a constrained game stage", () => {
    const grid = fitGridWithinRegion({ width: 260, height: 220 }, 5, 6);

    expect(grid).toEqual({ width: 260, height: 216 });
  });

  it("does not return a size for an unmeasurable region", () => {
    expect(fitGridWithinRegion({ width: 0, height: 300 }, 4, 4)).toBeNull();
  });
});
