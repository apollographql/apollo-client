import { FieldPolicy, Reference } from '../../cache';

type KeyArgs = FieldPolicy<any>["keyArgs"];

// A very basic pagination field policy that always concatenates new
// results onto the existing array, without examining options.args.
export function concatPagination<T = Reference>(
  keyArgs: KeyArgs = false,
): FieldPolicy<T[]> {
  return {
    keyArgs,
    merge(existing, incoming) {
      return existing ? [
        ...existing,
        ...incoming,
      ] : incoming;
    },
  };
}

// A basic field policy that uses options.args.{offset,limit} to splice
// the incoming data into the existing array. If your arguments are called
// something different (like args.{start,count}), feel free to copy/paste
// this implementation and make the appropriate changes.
export function offsetLimitPagination<T = Reference>(
  keyArgs: KeyArgs = false,
): FieldPolicy<T[]> {
  return {
    keyArgs,
    merge(existing, incoming, { args }) {
      const merged = existing ? existing.slice(0) : [];
      const start = args ? args.offset : merged.length;
      const end = start + incoming.length;
      for (let i = start; i < end; ++i) {
        merged[i] = incoming[i - start];
      }
      return merged;
    },
  };
}

type TInternalRelay<TNode> = Readonly<{
  edges: Array<{
    cursor: string;
    node: TNode;
  }>;
  pageInfo: Readonly<{
    hasPreviousPage: boolean;
    hasNextPage: boolean;
    startCursor: string;
    endCursor: string;
  }>;
}>;

// As proof of the flexibility of field policies, this function generates
// one that handles Relay-style pagination, without Apollo Client knowing
// anything about connections, edges, cursors, or pageInfo objects.
export function relayStylePagination<TNode = Reference>(
  keyArgs: KeyArgs = false,
): FieldPolicy<TInternalRelay<TNode>> {
  return {
    keyArgs,

    read(existing, { canRead }) {
      if (!existing) return;
      const edges = existing.edges.filter(edge => canRead(edge.node));
      return {
        // Some implementations return additional Connection fields, such
        // as existing.totalCount. These fields are saved by the merge
        // function, so the read function should also preserve them.
        ...existing,
        edges,
        pageInfo: {
          ...existing.pageInfo,
          startCursor: cursorFromEdge(edges, 0),
          endCursor: cursorFromEdge(edges, -1),
        },
      };
    },

    merge(existing = makeEmptyData(), incoming, { args }) {
      if (!args) return existing; // TODO Maybe throw?

      const incomingEdges = incoming.edges.slice(0);
      if (incoming.pageInfo) {
        updateCursor(incomingEdges, 0, incoming.pageInfo.startCursor);
        updateCursor(incomingEdges, -1, incoming.pageInfo.endCursor);
      }

      let prefix = existing.edges;
      let suffix: typeof prefix = [];

      if (args.after) {
        const index = prefix.findIndex(edge => edge.cursor === args.after);
        if (index >= 0) {
          prefix = prefix.slice(0, index + 1);
          // suffix = []; // already true
        }
      } else if (args.before) {
        const index = prefix.findIndex(edge => edge.cursor === args.before);
        suffix = index < 0 ? prefix : prefix.slice(index);
        prefix = [];
      } else {
        // If we have neither args.after nor args.before, the incoming
        // edges cannot be spliced into the existing edges, so they must
        // replace the existing edges. See #6592 for a motivating example.
        prefix = [];
      }

      const edges = [
        ...prefix,
        ...incomingEdges,
        ...suffix,
      ];

      const pageInfo = {
        ...incoming.pageInfo,
        ...existing.pageInfo,
        startCursor: cursorFromEdge(edges, 0),
        endCursor: cursorFromEdge(edges, -1),
      };

      const updatePageInfo = (name: keyof TInternalRelay<TNode>["pageInfo"]) => {
        const value = incoming.pageInfo[name];
        if (value !== void 0) {
          (pageInfo as any)[name] = value;
        }
      };
      if (!prefix.length) updatePageInfo("hasPreviousPage");
      if (!suffix.length) updatePageInfo("hasNextPage");

      return {
        ...existing,
        ...incoming,
        edges,
        pageInfo,
      };
    },
  };
}

function makeEmptyData() {
  return {
    edges: [],
    pageInfo: {
      hasPreviousPage: false,
      hasNextPage: true,
      startCursor: "",
      endCursor: "",
    },
  };
}

function cursorFromEdge<TNode>(
  edges: TInternalRelay<TNode>["edges"],
  index: number,
): string {
  if (index < 0) index += edges.length;
  const edge = edges[index];
  return edge && edge.cursor || "";
}

function updateCursor<TNode>(
  edges: TInternalRelay<TNode>["edges"],
  index: number,
  cursor: string | undefined,
) {
  if (index < 0) index += edges.length;
  const edge = edges[index];
  if (cursor && cursor !== edge.cursor) {
    edges[index] = { ...edge, cursor };
  }
}
