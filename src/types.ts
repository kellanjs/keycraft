// =============================================================================
// Core Types
// =============================================================================

export type QueryKey = readonly unknown[];
export type QueryKeyPart =
  | string
  | number
  | boolean
  | null
  | readonly QueryKeyPart[]
  | { readonly [key: string]: QueryKeyPart | undefined };

// =============================================================================
// Type Utilities
// =============================================================================

/** Extract $scope input type, or never if no $scope */
type ScopeInput<T> = T extends { $scope: (input: infer K) => QueryKeyPart }
  ? K
  : never;

/** Get child property keys (exclude $-prefixed properties) */
type ChildKeys<T> = {
  [K in keyof T]: K extends `$${string}` ? never : K;
}[keyof T];

/** Check if type is never */
type IsNever<T> = [T] extends [never] ? true : false;

// =============================================================================
// Node Inference
// =============================================================================

/**
 * Infer the output node type from a segment definition.
 *
 * Each node has:
 * - $key: QueryKey for this position in the tree
 * - Children mapped to their own InferNode
 * - Callable (if $scope is present) returning a scoped InferNode
 */
export type InferNode<T> =
  T extends Record<string, unknown>
    ? { readonly $key: QueryKey } & (IsNever<ScopeInput<T>> extends true
        ? object
        : (input: ScopeInput<T>) => InferNode<T>) & {
          [K in ChildKeys<T>]: InferNode<T[K]>;
        }
    : { readonly $key: QueryKey };

// =============================================================================
// Segment Definition
// =============================================================================

/**
 * Valid segment definition structure.
 *
 * Leaf segments can be:
 * - `null` — key-only segment
 * - `{}` — equivalent to null
 *
 * Branch segments are objects with child properties.
 * `$scope` makes a segment callable for parameterized keys.
 */
export type SegmentDefinition = null | {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $scope?: (input: any) => QueryKeyPart;
  // Index signature to allow $scope (function) and children (SegmentDefinition)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: ((input: any) => any) | SegmentDefinition | undefined;
};

// =============================================================================
// Output Types
// =============================================================================

/**
 * The output type of keycraft().
 * Maps each top-level key to its inferred node type.
 */
export type KeycraftKeys<T extends Record<string, unknown>> = {
  [K in keyof T]: InferNode<T[K]>;
};
