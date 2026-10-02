# keycraft

Type-safe query keys for TypeScript: describe your keys once as a tree, then
read every key from it, with exact types. Made with TanStack Query in mind,
and works with any library that uses array keys.

```ts
import { keycraft } from "@kellanjs/keycraft";

export const keys = keycraft({
  users: {
    list: null,
    byId: {
      $scope: (id: string) => id,
      posts: null,
    },
  },
});

keys.users.list.$key; // ["users", "list"]
keys.users.byId("42").$key; // ["users", "byId", "42"]
keys.users.byId("42").posts.$key; // ["users", "byId", "42", "posts"]
```

## The problem

Query libraries identify cached data by a key: an array like
`["users", "42", "posts"]`. Written by hand all over an app, keys drift apart:

```ts
useQuery({ queryKey: ["users", userId, "posts"], queryFn: fetchPosts });

// Elsewhere, after an update
queryClient.invalidateQueries({ queryKey: ["user", userId] }); // typo
```

Nothing fails. The typo just refreshes nothing, and the user sees stale data.
Refreshing "everything about this user" also relies on every one of those keys
starting the same way, which nothing enforces.

## What keycraft does

- **One definition for every key.** Keys are read from the tree
  (`keys.users.byId(id).posts.$key`), so they're spelled the same everywhere,
  and a typo is a compile error.
- **Keys nest.** A key always starts with its parent's key, so invalidating a
  parent refreshes everything below it.
- **Exact types.** `keys.users.byId("42").posts.$key` is typed
  `readonly ["users", "byId", string, "posts"]`, and TanStack Query passes that
  type on to your query function.
- **Mistakes in the definition are compile errors**, reported where the
  mistake is.

It has no dependencies, and no ties to any one query library: a key is a plain
array.

## Install

```sh
npm install @kellanjs/keycraft
```

## Requirements

- **TypeScript 5.0 or newer.** `strict` mode is recommended, but not required
  (see [Good to know](#good-to-know)).
- **An ES2020 runtime:** Node 18+, Chrome 80+, Firefox 74+, Safari 13.1+.
- **ES modules.** The package has no CommonJS build.

## Quick start

### 1. Define your keys

Each property becomes a node, and `$key` is the path to it. A node with
`$scope` takes arguments, which become part of the key.

```ts
import { keycraft } from "@kellanjs/keycraft";

export const keys = keycraft({
  users: {
    list: null,
    byId: {
      $scope: (id: string) => id,
      profile: null,
      posts: null,
    },
  },
});
```

### 2. Use them in queries

```tsx
import { useQuery } from "@tanstack/react-query";

function UserPosts({ userId }: { userId: string }) {
  const posts = useQuery({
    queryKey: keys.users.byId(userId).posts.$key,
    queryFn: () => fetchPosts(userId),
  });
  // ...
}
```

### 3. Invalidate by prefix

Use a shorter key to refresh everything below it:

```ts
// This user's profile and posts
queryClient.invalidateQueries({ queryKey: keys.users.byId(userId).$key });

// Every user's profile and posts (but not the list)
queryClient.invalidateQueries({ queryKey: keys.users.byId.$key });

// Everything about users, the list included
queryClient.invalidateQueries({ queryKey: keys.users.$key });
```

## How keys are built

Each level adds one element to the key: the property's name, or, when you call
a scoped node, whatever its `$scope` returns.

| Expression                         | Key                                |
| ---------------------------------- | ---------------------------------- |
| `keys.users.$key`                  | `["users"]`                        |
| `keys.users.list.$key`             | `["users", "list"]`                |
| `keys.users.byId.$key`             | `["users", "byId"]`                |
| `keys.users.byId("42").$key`       | `["users", "byId", "42"]`          |
| `keys.users.byId("42").posts.$key` | `["users", "byId", "42", "posts"]` |

So every key starts with its parent's key. That's what makes invalidating by
prefix work: query libraries like TanStack Query treat a key as matching every
key that starts with it.

## Guide

### Leaves: `null` or `{}`

A node with no children is written `null` or `{}`; the two mean the same.

```ts
const keys = keycraft({
  settings: null,
  users: {
    list: {},
  },
});

keys.settings.$key; // ["settings"]
keys.users.list.$key; // ["users", "list"]
```

### Keys that take arguments: `$scope`

`$scope` turns a node into a function. Calling it runs the scope with your
arguments, and adds what it returns to the key, as one element:

```ts
interface Filters {
  status: "open" | "done";
  page: number;
}

const keys = keycraft({
  todos: {
    byId: { $scope: (id: number) => id },
    list: { $scope: (filters: Filters) => filters },
    between: {
      $scope: (from: Date, to: Date) => [from.toISOString(), to.toISOString()],
    },
  },
});

keys.todos.byId(7).$key; // ["todos", "byId", 7]
keys.todos.list({ status: "open", page: 1 }).$key;
// ["todos", "list", { status: "open", page: 1 }]
keys.todos.between(new Date("2026-01-01"), new Date("2026-01-31")).$key;
// ["todos", "between", ["2026-01-01T00:00:00.000Z", "2026-01-31T00:00:00.000Z"]]
```

The scope can have any parameters, and its parameter names show up when you
call the node. It must return plain data: strings, numbers, booleans, `null`,
`undefined`, and arrays and plain objects of those. Returning an object is
fine: TanStack Query compares objects by their contents, whatever order their
properties are in.

Anything else is a compile error, because query libraries can't compare it
reliably. That includes functions, a `Map`, a `bigint`, and dates: a `Date`
has no properties of its own, so TanStack Query's prefix matching would treat
every date as equal. Return `date.toISOString()` or `date.getTime()` instead,
as above.

Return plain objects rather than class instances. Query libraries compare keys
by their own enumerable properties, so an instance that keeps its data in
private fields or getters looks empty, and two different instances become the
same key. The type check can't see private fields, so this one is up to you.

For parameters that can take different forms, use a union of parameter lists:
`(...args: [id: string] | [first: string, last: string]) => args`. (An
overloaded function also works, but TypeScript only keeps its last overload.)

A scoped node's children are only on what the call returns, so you can't
forget the arguments:

```ts
const keys = keycraft({
  users: {
    byId: { $scope: (id: string) => id, posts: null },
  },
});

keys.users.byId("42").posts.$key; // ["users", "byId", "42", "posts"]
// @ts-expect-error: forgot the id
keys.users.byId.posts;
```

`keys.users.byId.$key` (without calling it) is still there: it's the prefix of
every user's key, for invalidating them all.

#### Optional arguments

A scope may have optional parameters. Whatever it returns goes in the key,
`undefined` included, so `page()` and `page(1)` are different keys:

```ts
const keys = keycraft({
  todos: {
    page: { $scope: (page?: number) => page },
  },
});

keys.todos.page().$key; // ["todos", "page", undefined]
keys.todos.page(1).$key; // ["todos", "page", 1]
```

If no argument should mean page 1, say so in the scope:
`(page?: number) => page ?? 1`.

One caution: query libraries don't always tell `undefined` and `null` apart.
TanStack Query, for example, treats them as the same key when it looks a query
up, but as different keys when matching by prefix. So don't let a scope return
both and rely on them being different.

### Lists next to their items

Because keys match by prefix, a node that's used as a query **and** has
children also matches those children. Here, the notebook's notes list is
`byNotebook(id)` itself, and its search results sit below it:

```ts
const keys = keycraft({
  notes: {
    byNotebook: {
      $scope: (id: string) => id,
      search: { $scope: (query: string) => query },
    },
  },
});

// Meant for the list, but also cancels any search for that notebook
queryClient.cancelQueries({ queryKey: keys.notes.byNotebook(id).$key });
```

You can pass `exact: true` every time, but it's easier to give each query its
own leaf, and use the nodes above them only as prefixes:

```ts
const keys = keycraft({
  notes: {
    byNotebook: {
      $scope: (id: string) => id,
      list: null, // the notes list
      search: { $scope: (query: string) => query },
    },
  },
});

// Only the list
queryClient.cancelQueries({ queryKey: keys.notes.byNotebook(id).list.$key });

// The list and every search, on purpose
queryClient.invalidateQueries({ queryKey: keys.notes.byNotebook(id).$key });
```

### Reusing parts with `segment()`

`segment()` checks part of a definition on its own and keeps its exact type,
so it can live in its own file or be used in several places:

```ts
import { keycraft, segment } from "@kellanjs/keycraft";

const paginated = segment({
  page: { $scope: (page: number) => page },
});

const keys = keycraft({
  users: paginated,
  posts: { drafts: paginated },
});

keys.users.page(2).$key; // ["users", "page", 2]
keys.posts.drafts.page(1).$key; // ["posts", "drafts", "page", 1]
```

### Typed query functions

TanStack Query passes the key to your query function. Since keycraft's keys
have exact types, you can read arguments straight out of the key:

```ts
const user = useQuery({
  queryKey: keys.users.byId(userId).profile.$key,
  queryFn: ({ queryKey: [, , id] }) => fetchProfile(id), // id: string
});
```

### Other libraries

keycraft doesn't depend on TanStack Query: `$key` is a plain array, so it works
anywhere an array key does, such as SWR, Pinia Colada, or TanStack Query's
Vue, Solid and Svelte versions. Invalidating by prefix depends on the library
matching keys by prefix, as TanStack Query does.

### Types

Mostly, `typeof` is all you need: `typeof keys` for the tree, and
`(typeof node)["$key"]` for one node's key. For functions that work with any
key or node, there are two general types:

```ts
import type { KeyNode, KeycraftKey } from "@kellanjs/keycraft";

function logKey(node: KeyNode) {
  console.log(node.$key);
}

logKey(keys.users.byId("42"));

const recent: KeycraftKey[] = [keys.users.list.$key];
```

### Mistakes caught at compile time

keycraft checks the definition and reports each mistake where it is, while the
rest of the tree stays typed:

```ts
const keys = keycraft({
  users: {
    // @ts-expect-error: Key 'users.byId' is a function: to make a key that
    // takes arguments, use { $scope: ... }
    byId: (id: string) => id,
    // @ts-expect-error: Key 'users.$scoep' can't start with '$': that prefix is
    // reserved for keycraft's own properties, like $scope
    $scoep: (id: string) => id,
  },
});
```

It also catches keys that aren't `null` or an object, and scopes that return
something that can't go in a key. The same checks run when `keycraft()` is
called, so JavaScript code gets a `TypeError` that names the key.

## API reference

### `keycraft(definition)`

Builds a key tree. `definition` is an object whose properties are:

- `null` or `{}`: a node with no children
- an object: a node with a child for each property
- an object with `$scope: (...args) => value`: a node that's called with the
  scope's arguments. The call returns a node whose key ends with `value`, and
  which has the other properties as children.

Keys can't start with `$`, except `$scope`.

### `segment(definition)`

Returns `definition` unchanged, after checking it like `keycraft()` does (at
compile time only). Use it for parts of a definition that you define
separately.

### Nodes

- **`node.$key`**: the node's key, a frozen array.
- **`node(...args)`**, for a node with `$scope`: a new node, whose key adds
  the scope's return value.

### Types

| Type              | Description                                               |
| ----------------- | --------------------------------------------------------- |
| `KeycraftKey`     | Any key: `readonly unknown[]`                             |
| `KeyNode`         | Any node: `{ readonly $key: KeycraftKey }`                |
| `KeycraftKeys<T>` | The tree that `keycraft()` returns for the definition `T` |

## Good to know

- **Nodes can't be changed**, and neither can their keys. Copy a key if you
  need to extend it: `[...keys.users.$key, "extra"]`.
- **`$key` isn't enumerable**, so `Object.keys(node)` lists only its children.
- **A node turns into its key in a string**, e.g. `${keys.users.list}` is
  `["users","list"]`, which helps in log messages.
- **Calling a scoped node builds a new node each time**, including its
  children. That's cheap, but the result isn't cached.
- **Without `strictNullChecks`,** TypeScript types `null` as `any`. Leaves
  still work, but a `$`-prefixed key whose value is `null` isn't caught until
  runtime. With `noImplicitAny` on, TypeScript may also report `null` leaves as
  implicitly `any`; write them as `{}` instead.

## Development

```sh
npm install
npm run ci
```

`npm run ci` lints, type-checks, builds, checks formatting and the package's
exports, and runs the tests:

- `tests/keycraft.test.ts`: the runtime
- `tests/keycraft.test-d.ts`: types (checked by `tsc`, not run)
- `tests/tanstack.test.ts`: the keys in a real TanStack Query cache
- `tests/package-consumer.test.ts`: the built package, imported by name
- `tests/declaration-emit.test.ts`: exporting trees and nodes from a project
  that emits `.d.ts` files
- `tests/error-messages.test.ts`: the wording of compile-time errors

## Thanks

If you made it this far, thanks for checking out the library, and I hope you find it useful in your projects!

## License

Keycraft is open source under the terms of the [MIT license](https://github.com/kellanjs/keycraft/blob/main/LICENSE).
