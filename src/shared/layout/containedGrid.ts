/**
 * Geometry helpers for grids that must fit a bounded play region.
 *
 * Boards always use the available stage rather than extending the document.
 * This keeps a full level visible on short displays as well as desktop.
 */
export interface GridDimensions {
  readonly width: number;
  readonly height: number;
}

/**
 * Returns a centred grid size that uses as much of a region as possible while
 * preserving the board's column-to-row ratio.
 */
export function fitGridWithinRegion(
  region: GridDimensions,
  rows: number,
  columns: number,
): GridDimensions | null {
  if (region.width <= 0 || region.height <= 0 || rows <= 0 || columns <= 0) {
    return null;
  }

  const ratio = columns / rows;
  const width = Math.floor(Math.min(region.width, region.height * ratio));
  const height = Math.floor(width / ratio);

  if (width <= 0 || height <= 0) return null;

  return {
    width,
    height,
  };
}
