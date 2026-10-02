/**
 * # KEYCRAFT
 *
 * Query keys as a typed tree. Describe the shape of your keys once, then read
 * every key from the tree instead of writing arrays by hand.
 *
 * @example
 * ```ts
 * const keys = keycraft({
 *   users: {
 *     list: null,
 *     byId: {
 *       $scope: (id: string) => id,
 *       posts: null,
 *     },
 *   },
 * });
 *
 * keys.users.$key; // ["users"]
 * keys.users.list.$key; // ["users", "list"]
 * keys.users.byId.$key; // ["users", "byId"]
 * keys.users.byId("42").$key; // ["users", "byId", "42"]
 * keys.users.byId("42").posts.$key; // ["users", "byId", "42", "posts"]
 * ```
 *
 * @remarks
 * - Every key starts with its parent's key, so a parent's key can be used to
 *   match all of its descendants (e.g. TanStack Query's `invalidateQueries`)
 * - A node with `$scope` is a function. Calling it adds the scope's return
 *   value to the key, and the node's children exist only on the result
 * - Properties starting with `$` belong to keycraft, so keys can't start
 *   with `$`
 */

// =============================================================================
// Public Types
// =============================================================================

/** Any key made by keycraft. */
export type KeycraftKey = readonly unknown[];

/** Any node of a key tree, e.g. for a function that accepts any node. */
export type KeyNode = { readonly $key: KeycraftKey };

/** The key tree that `keycraft()` returns for the definition `T`. */
export type KeycraftKeys<T> = {
  readonly [K in ChildName<T>]: NodeOf<T[K], [KeyName<K>]>;
};

// =============================================================================
// Node Types
//
// `Path` is the node's key as a tuple, e.g. ["users", "byId", string]. It
// grows by one element per level: the child's name, or a scope's return type.
// =============================================================================

type NodeOf<TDef, Path extends unknown[]> =
  IsAny<TDef> extends true
    ? BranchNode<null, Path> // `null` without strictNullChecks
    : TDef extends { readonly $scope: AnyFunction }
      ? ScopeNode<
          ScopeArgs<TDef["$scope"]>,
          BranchNode<TDef, [...Path, ScopeValue<TDef["$scope"]>]>,
          Path
        >
      : BranchNode<TDef, Path>;

// The two node types below are written as conditionals that always take their
// first branch, so that hovers and errors show the node's members (its key and
// children) instead of the type's name and the whole definition.

/** A node without `$scope`: its key, plus a node for each child. */
type BranchNode<TDef, Path extends unknown[]> = TDef extends unknown
  ? {
      readonly [K in "$key" | ChildName<TDef>]: K extends "$key"
        ? readonly [...Path]
        : NodeOf<TDef[K & keyof TDef], [...Path, KeyName<K>]>;
    }
  : never;

/**
 * A node with `$scope`: callable with the scope's own parameters. The children
 * are on the node it returns, so they can't be reached without the arguments.
 */
type ScopeNode<
  Args extends readonly unknown[],
  Scoped,
  Path extends unknown[],
> = [Args] extends [unknown] // in brackets, so a union of tuples stays one signature
  ? {
      (...args: Args): Scoped;
      readonly $key: readonly [...Path];
    }
  : never;

/** The keys of `TDef` that become child nodes. */
type ChildName<TDef> = {
  [K in keyof TDef]-?: K extends `$${string}` | symbol
    ? never
    : IsSegment<TDef[K]> extends true
      ? K
      : never;
}[keyof TDef];

/** Object keys may be numbers in types, but are always strings at runtime. */
type KeyName<K> = K extends number ? `${K}` : K;

type IsSegment<T> =
  IsAny<T> extends true // `null` without strictNullChecks
    ? true
    : T extends null
      ? true
      : T extends AnyFunction | readonly unknown[]
        ? false
        : T extends object
          ? true
          : false;

type IsAny<T> = 0 extends 1 & T ? true : false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => unknown;

// `extends readonly unknown[]` lets this read a readonly rest parameter, which
// a plain `infer` (and TypeScript's own `Parameters`) can't
type ScopeArgs<TScope> = TScope extends (
  ...args: infer Args extends readonly unknown[]
) => unknown
  ? Args
  : never;

type ScopeValue<TScope> = TScope extends (...args: never) => infer Value
  ? Value
  : never;

// =============================================================================
// Compile-time Definition Checks
//
// Invalid definitions also throw at runtime, but these turn them into type
// errors at the mistake itself. Each check replaces a bad value's expected type
// with a message, so the error reads "Type 'number' is not assignable to type
// '"Key 'users.count' must be null or an object"'". Messages use single quotes
// because double quotes would be printed escaped.
//
// The definition is inferred without a structural constraint, so one mistake
// doesn't stop the rest of the tree from being typed.
// =============================================================================

type CheckTree<T> = {
  [K in keyof T]: K extends `$${string}`
    ? ReservedKey<KeyName<K>>
    : K extends string | number
      ? CheckSegment<T[K], KeyName<K>>
      : T[K];
};

type CheckSegment<T, Path extends string> = T extends null
  ? T
  : T extends AnyFunction
    ? `${Subject<Path>} is a function: to make a key that takes arguments, use { $scope: ... }`
    : T extends readonly unknown[]
      ? `${Subject<Path>} must be null or an object, not an array`
      : T extends object
        ? {
            [K in keyof T]: K extends "$scope"
              ? CheckScope<T[K], JoinPath<Path, K>>
              : K extends `$${string}`
                ? ReservedKey<JoinPath<Path, K>>
                : K extends string | number
                  ? CheckSegment<T[K], JoinPath<Path, KeyName<K>>>
                  : T[K];
          }
        : `${Subject<Path>} must be null or an object`;

type CheckScope<T, Path extends string> = T extends AnyFunction
  ? IsKeyData<ScopeValue<T>> extends true
    ? T
    : (
        ...args: ScopeArgs<T>
      ) => `Key '${Path}' must return key data: strings, numbers, booleans, null, undefined, or arrays and plain objects of those (for a Date, return date.toISOString() or date.getTime())`
  : `Key '${Path}' must be a function`;

type ReservedKey<Path extends string> =
  `Key '${Path}' can't start with '$': that prefix is reserved for keycraft's own properties, like $scope`;

/** A segment checked on its own (by `segment()`) has no path yet. */
type Subject<Path extends string> = Path extends ""
  ? "The segment"
  : `Key '${Path}'`;

type JoinPath<Prefix extends string, K extends string> = Prefix extends ""
  ? K
  : `${Prefix}.${K}`;

/**
 * Whether a scope's return type can go in a key: plain data, which query
 * libraries can both serialize (for exact lookups) and compare property by
 * property (for prefix matching). Functions, symbols, bigints and objects with
 * methods are rejected. That includes `Date`: it serializes fine, but it has no
 * properties of its own, so TanStack Query's prefix matching treats every date
 * as equal.
 *
 * `Depth` stops the check after a few levels, so that recursive types (like a
 * tree of nodes) end instead of failing as "excessively deep". Anything deeper
 * is accepted.
 */
type IsKeyData<T, Depth extends unknown[] = []> =
  IsAny<T> extends true
    ? true
    : unknown extends T
      ? true
      : Depth["length"] extends 5
        ? true
        : false extends (T extends unknown ? IsKeyDataMember<T, Depth> : never)
          ? false
          : true;

type IsKeyDataMember<T, Depth extends unknown[]> = T extends
  string | number | boolean | null | undefined
  ? true
  : T extends AnyFunction | symbol | bigint
    ? false
    : T extends readonly (infer Item)[]
      ? IsKeyData<Item, [...Depth, unknown]>
      : T extends object
        ? false extends {
            [K in keyof T]-?: K extends symbol
              ? false
              : IsKeyData<T[K], [...Depth, unknown]>;
          }[keyof T]
          ? false
          : true
        : false;

/**
 * `T` when it passes the check, otherwise the check's result (which contains
 * the messages). Written as a conditional so TypeScript still infers `T` from
 * the argument.
 */
type Checked<T, TCheck> = T extends TCheck ? T : TCheck;

// =============================================================================
// Runtime
// =============================================================================

type Definition = Record<string, unknown>;
type Scope = (...args: unknown[]) => unknown;

function isPlainObject(value: unknown): value is Definition {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function assertKeyName(name: string, path: string) {
  if (name.startsWith("$")) {
    throw new TypeError(
      `Keycraft key "${path}" can't start with "$": that prefix is reserved for keycraft's own properties, like $scope.`,
    );
  }
}

/** Throws for anything the types reject, for JavaScript callers and casts. */
function assertSegment(value: unknown, path: string, ancestors: object[]) {
  if (value === null) {
    return;
  }
  if (typeof value === "function") {
    throw new TypeError(
      `Keycraft key "${path}" is a function. To make a key that takes arguments, use { $scope: ... }.`,
    );
  }
  if (!isPlainObject(value)) {
    throw new TypeError(`Keycraft key "${path}" must be null or an object.`);
  }
  if (ancestors.includes(value)) {
    throw new TypeError(`Keycraft key "${path}" contains itself.`);
  }
  for (const [name, child] of Object.entries(value)) {
    if (name === "$scope") {
      if (typeof child !== "function") {
        throw new TypeError(
          `Keycraft key "${path}.$scope" must be a function.`,
        );
      }
      continue;
    }
    assertKeyName(name, `${path}.${name}`);
    assertSegment(child, `${path}.${name}`, [...ancestors, value]);
  }
}

function describeKey(key: KeycraftKey) {
  try {
    return JSON.stringify(key);
  } catch {
    return String(key);
  }
}

/**
 * Gives a node its key. The key is frozen because it's shared by everyone who
 * reads it. `Symbol.toPrimitive` lets a node be used in a string (nodes have no
 * prototype, so they'd otherwise throw), e.g. in a log message.
 */
function finishNode<T extends object>(node: T, key: unknown[]): T {
  const frozenKey = Object.freeze(key);
  Object.defineProperties(node, {
    $key: { value: frozenKey },
    [Symbol.toPrimitive]: { value: () => describeKey(frozenKey) },
  });
  return Object.freeze(node);
}

function createNode(key: unknown[], definition: Definition | null): object {
  const scope = definition?.$scope as Scope | undefined;
  if (scope && definition) {
    const node = (...args: unknown[]) =>
      createBranch([...key, scope(...args)], definition);
    return finishNode(node, key);
  }
  return createBranch(key, definition);
}

/**
 * Nodes have no prototype, so any child name works, even `__proto__` or
 * `toString`. (The functions made for `$scope` have no children: those are on
 * the node the function returns.)
 */
function createBranch(key: unknown[], definition: Definition | null) {
  const node = Object.create(null) as Definition;
  for (const [name, child] of Object.entries(definition ?? {})) {
    if (name !== "$scope") {
      node[name] = createNode([...key, name], child as Definition | null);
    }
  }
  return finishNode(node, key);
}

// =============================================================================
// Public Functions
// =============================================================================

/**
 * Builds a key tree from a definition. Each property becomes a node whose
 * `$key` is the path to it:
 *
 * - `null` or `{}`: a node with no children
 * - an object: a node with a child for each property
 * - an object with `$scope`: a node that's called with the scope's arguments,
 *   e.g. `keys.users.byId("42")`, to add the scope's return value to the key
 *
 * @example
 * ```ts
 * const keys = keycraft({
 *   users: {
 *     list: null,
 *     byId: { $scope: (id: string) => id, posts: null },
 *   },
 * });
 *
 * keys.users.byId("42").posts.$key; // ["users", "byId", "42", "posts"]
 * ```
 */
export function keycraft<const T extends object>(
  definition: Checked<T, CheckTree<T>>,
): KeycraftKeys<T> {
  if (!isPlainObject(definition)) {
    throw new TypeError("keycraft() takes an object of keys.");
  }

  const tree = Object.create(null) as Definition;
  for (const [name, child] of Object.entries(definition)) {
    assertKeyName(name, name);
    assertSegment(child, name, [definition]);
    tree[name] = createNode([name], child as Definition | null);
  }
  return Object.freeze(tree) as KeycraftKeys<T>;
}

/**
 * Checks a part of a definition on its own, keeping its exact type, so it can
 * live in another file or be reused in several places.
 *
 * @example
 * ```ts
 * const paginated = segment({
 *   page: { $scope: (page: number) => page },
 * });
 *
 * const keys = keycraft({
 *   users: paginated,
 *   posts: paginated,
 * });
 *
 * keys.posts.page(2).$key; // ["posts", "page", 2]
 * ```
 */
export function segment<const T extends object | null>(
  definition: Checked<T, CheckSegment<T, "">>,
): T {
  return definition as T;
}
