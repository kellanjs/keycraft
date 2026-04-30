import type { KeycraftKeys, SegmentDefinition } from "./types.js";

// =============================================================================
// Internal Types
// =============================================================================

interface InternalNode {
  readonly $key: readonly unknown[];
  [key: string]: unknown;
}

type SegmentDef = null | Record<string, unknown>;

// =============================================================================
// Utilities
// =============================================================================

function toQueryKey(parts: unknown[]): readonly unknown[] {
  return parts.filter((p) => p !== undefined);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasScope(def: SegmentDef): boolean {
  return isRecord(def) && typeof def.$scope === "function";
}

function getChildKeys(def: SegmentDef): string[] {
  if (!isRecord(def)) return [];
  return Object.keys(def).filter((key) => {
    if (key.startsWith("$")) return false;
    const value = def[key];
    return value === null || isRecord(value);
  });
}

// =============================================================================
// Node Creation
// =============================================================================

function createNode(keyParts: unknown[]): InternalNode {
  const node = Object.create(null) as InternalNode;
  Object.defineProperty(node, "$key", {
    value: toQueryKey(keyParts),
    enumerable: false,
    writable: false,
  });
  return node;
}

// =============================================================================
// Segment Processing
// =============================================================================

function processSegment(
  baseParts: unknown[],
  definition: SegmentDef,
): InternalNode {
  const node = createNode(baseParts);

  if (!isRecord(definition)) {
    return node;
  }

  // Process child segments
  for (const childName of getChildKeys(definition)) {
    const childDef = definition[childName] as SegmentDef;
    node[childName] = processSegment([...baseParts, childName], childDef);
  }

  // Handle $scope — makes the node callable
  if (hasScope(definition)) {
    const scopeFn = definition.$scope as (input: unknown) => unknown;

    const createScopedNode = (input: unknown): InternalNode => {
      const scopeValue = scopeFn(input);
      const scopedParts = [...baseParts, scopeValue];
      const scopedNode = createNode(scopedParts);

      // Process children for scoped node
      for (const childName of getChildKeys(definition)) {
        const childDef = definition[childName] as SegmentDef;
        scopedNode[childName] = processSegment(
          [...scopedParts, childName],
          childDef,
        );
      }

      return scopedNode;
    };

    // Make the node callable by merging function + node properties
    const callableNode = Object.assign(createScopedNode, node) as InternalNode &
      ((input: unknown) => InternalNode);

    // Copy non-enumerable $key to callable node
    Object.defineProperty(callableNode, "$key", {
      enumerable: false,
      value: node.$key,
      writable: false,
    });

    // Copy children to callable node
    for (const childName of getChildKeys(definition)) {
      callableNode[childName] = node[childName];
    }

    return callableNode as unknown as InternalNode;
  }

  return node;
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Creates a type-safe query key structure from a definition object.
 *
 * @example
 * ```typescript
 * const k = keycraft({
 *   users: {
 *     userId: {
 *       $scope: (id: string) => id,
 *       posts: { all: {} },
 *     },
 *     all: {},
 *   },
 * });
 *
 * k.users.all.$key                        // ["users", "all"]
 * k.users.userId("abc").$key              // ["users", "userId", "abc"]
 * k.users.userId("abc").posts.all.$key    // ["users", "userId", "abc", "posts", "all"]
 * ```
 */
export function keycraft<const T extends Record<string, SegmentDefinition>>(
  definition: T,
): KeycraftKeys<T> {
  const result: Record<string, InternalNode> = {};
  for (const [name, def] of Object.entries(definition)) {
    if (!name.startsWith("$")) {
      result[name] = processSegment([name], def as SegmentDef);
    }
  }
  return result as KeycraftKeys<T>;
}
