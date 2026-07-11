import { useCallback, useLayoutEffect, useState, type RefCallback } from "react";

import { fitGridWithinRegion, type GridDimensions } from "../layout/containedGrid";

interface ContainedGridSize {
  readonly regionRef: RefCallback<HTMLDivElement>;
  readonly dimensions: GridDimensions | null;
}

function isEqualDimensions(
  left: GridDimensions | null,
  right: GridDimensions | null,
): boolean {
  return left?.width === right?.width && left?.height === right?.height;
}

/**
 * Measures a bounded board stage and keeps a row/column grid fully contained
 * inside it. ResizeObserver also covers viewport rotation and browser chrome
 * changes on mobile.
 */
export function useContainedGridSize(rows: number, columns: number): ContainedGridSize {
  const [region, setRegion] = useState<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<GridDimensions | null>(null);
  const regionRef = useCallback<RefCallback<HTMLDivElement>>((node) => {
    setRegion(node);
  }, []);

  useLayoutEffect(() => {
    if (region === null) return undefined;

    const measure = (): void => {
      const next = fitGridWithinRegion({
        width: region.clientWidth,
        height: region.clientHeight,
      }, rows, columns);
      setDimensions((current) => (isEqualDimensions(current, next) ? current : next));
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(region);

    return () => observer.disconnect();
  }, [columns, region, rows]);

  return { regionRef, dimensions };
}
