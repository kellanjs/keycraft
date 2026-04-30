# keycraft

Type-safe query key builder for TanStack Query and other cache/state management libraries.

`keycraft` helps you define query keys as a structured tree instead of hand-writing string arrays everywhere. It gives you:

- readable query key definitions
- type-safe nested access
- parameterized keys with `$scope`
- reusable segments with `segment()`

## Install

```bash
npm install @kellanjs/keycraft
```

## Quick start

```ts
import { keycraft } from "@kellanjs/keycraft";

const k = keycraft({
  users: {
    all: null,
    userId: {
      $scope: (id: string) => id,
      posts: { all: null },
    },
  },
});

k.users.all.$key;
// ["users", "all"]

k.users.userId("123").$key;
// ["users", "userId", "123"]

k.users.userId("123").posts.all.$key;
// ["users", "userId", "123", "posts", "all"]
```

## Core concepts

### 1. Build a key tree

Each top-level property becomes a root key segment.

```ts
const k = keycraft({
  posts: { recent: null },
});

k.posts.recent.$key;
// ["posts", "recent"]
```

### 2. Use `null` or `{}` for leaf nodes

Both represent a key with no children.

```ts
const k = keycraft({
  users: {
    all: null,
    recent: {},
  },
});
```

### 3. Use `$scope` for parameterized segments

`$scope` makes a node callable.

```ts
const k = keycraft({
  users: {
    userId: {
      $scope: (id: string) => id,
    },
  },
});

k.users.userId("abc").$key;
// ["users", "userId", "abc"]
```

You can use any value that makes sense for your query key, including numbers or objects.

```ts
const k = keycraft({
  search: {
    filter: {
      $scope: (params: { status: string; role: string }) =>
        `${params.status}-${params.role}`,
      results: null,
    },
  },
});

k.search.filter({ status: "active", role: "admin" }).results.$key;
// ["search", "filter", "active-admin", "results"]
```

### 4. Reuse parts of the tree with `segment()`

If you want to define a segment once and reuse it in multiple places, use `segment()`.

```ts
import { keycraft, segment } from "@kellanjs/keycraft";

const pagination = segment({
  page: {
    $scope: (page: number) => page,
  },
});

const k = keycraft({
  users: {
    all: pagination,
  },
  posts: {
    all: pagination,
  },
});

k.users.all.page(1).$key;
// ["users", "all", "page", 1]

k.posts.all.page(2).$key;
// ["posts", "all", "page", 2]
```

## API

### `keycraft(definition)`

Creates a typed key tree from a definition object.

```ts
import { keycraft } from "@kellanjs/keycraft";

const k = keycraft({
  todos: { all: null },
});
```

### `segment(definition)`

Identity helper for defining reusable segments with preserved type inference.

```ts
import { segment } from "@kellanjs/keycraft";

const userSegment = segment({
  $scope: (id: string) => id,
  posts: { all: null },
});
```

## Type exports

The package also exports useful TypeScript types:

- `QueryKey`
- `KeycraftKeys`
- `InferNode`
- `SegmentDefinition`

## Notes

- `$key` is readonly and non-enumerable.
- Child nodes still work on scoped nodes.
- Properties starting with `$` are reserved for internal metadata and are ignored by `keycraft()`.

## Example: TanStack Query

```ts
import { useQuery } from "@tanstack/react-query";
import { keycraft } from "@kellanjs/keycraft";

const k = keycraft({
  users: {
    all: null,
    userId: {
      $scope: (id: string) => id,
      profile: null,
    },
  },
});

function UserProfile({ userId }: { userId: string }) {
  const query = useQuery({
    queryKey: k.users.userId(userId).profile.$key,
    queryFn: async () => {
      // fetch user profile
    },
  });

  return null;
}
```

## Development

```bash
npm run ci
```

This runs linting, type-checking, build, formatting checks, export validation, and tests.

## Thanks

If you made it this far, thanks for checking out the library, and I hope you find it useful in your projects!

## License

Keycraft is open source under the terms of the [MIT license](https://github.com/kellanjs/keycraft/blob/main/LICENSE).