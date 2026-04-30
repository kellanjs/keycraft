import type { SegmentDefinition } from "./types.js";

/**
 * Identity function for defining segments with full type inference.
 * Useful for defining segments in separate files.
 *
 * @example
 * ```typescript
 * const usersSegment = segment({
 *   $scope: (id: string) => id,
 *   posts: { all: {} },
 * });
 * ```
 */
export function segment<const T extends SegmentDefinition>(definition: T): T {
  return definition;
}
