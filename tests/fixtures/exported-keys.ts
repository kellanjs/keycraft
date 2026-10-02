// Compiled by declaration-emit.test.ts. A typical keys module that exports its
// tree, a reusable segment, and nodes taken from the tree.
import { keycraft, segment } from "@kellanjs/keycraft";

export const paginated = segment({
  page: { $scope: (page: number) => page },
});

export const keys = keycraft({
  notes: {
    list: null,
    byNotebook: {
      $scope: (id: string) => id,
      search: { $scope: (params: { query: string }) => params },
      pages: paginated,
    },
  },
});

export const notebookNode = keys.notes.byNotebook;
export const notebook = keys.notes.byNotebook("nb");
export const searchKey = keys.notes
  .byNotebook("nb")
  .search({ query: "a" }).$key;
