import { __rest } from "tslib";

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

// Whether TEdge<TNode> is a normalized Reference or a non-normalized
// object, it needs a .cursor property where the relayStylePagination
// merge function can store cursor strings taken from pageInfo. Storing an
// extra reference.cursor property should be safe, and is easier than
// attempting to update the cursor field of the normalized StoreObject
// that the reference refers to, or managing edge wrapper objects
// (something I attempted in #7023, but abandoned because of #7088).
type TEdge<TNode> = {
  cursor?: string;
  node: TNode;
} | (Reference & { cursor?: string });

type TPageInfo = {
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  startCursor: string;
  endCursor: string;
};

type TExistingRelay<TNode> = Readonly<{
  edges: TEdge<TNode>[];
  pageInfo: TPageInfo;
}>;

type TIncomingRelay<TNode> = {
  edges?: TEdge<TNode>[];
  pageInfo?: TPageInfo;
};

type RelayFieldPolicy<TNode> = FieldPolicy<
  TExistingRelay<TNode>,
  TIncomingRelay<TNode>,
  TIncomingRelay<TNode>
>;

// As proof of the flexibility of field policies, this function generates
// one that handles Relay-style pagination, without Apollo Client knowing
// anything about connections, edges, cursors, or pageInfo objects.
export function relayStylePagination<TNode = Reference>(
  keyArgs: KeyArgs = false,
): RelayFieldPolicy<TNode> {
  return {
    keyArgs,

    read(existing, { canRead, readField }) {
      if (!existing) return;

      const edges: TEdge<TNode>[] = [];
      let startCursor = "";
      let endCursor = "";
      existing.edges.forEach(edge => {
        // Edges themselves could be Reference objects, so it's important
        // to use readField to access the edge.edge.node property.
        if (canRead(readField("node", edge))) {
          edges.push(edge);
          if (edge.cursor) {
            startCursor = startCursor || edge.cursor;
            endCursor = edge.cursor;
          }
        }
      });

      return {
        // Some implementations return additional Connection fields, such
        // as existing.totalCount. These fields are saved by the merge
        // function, so the read function should also preserve them.
        ...getExtras(existing),
        edges,
        pageInfo: {
          ...existing.pageInfo,
          startCursor,
          endCursor,
        },
      };
    },

    merge(existing = makeEmptyData(), incoming, { args, isReference, readField }) {
      const incomingEdges = incoming.edges ? incoming.edges.map(edge => {
        if (isReference(edge = { ...edge })) {
          // In case edge is a Reference, we read out its cursor field and
          // store it as an extra property of the Reference object.
          edge.cursor = readField<string>("cursor", edge);
        }
        return edge;
      }) : [];

      if (incoming.pageInfo) {
        // In case we did not request the cursor field for edges in this
        // query, we can still infer some of those cursors from pageInfo.
        const { startCursor, endCursor } = incoming.pageInfo;
        const firstEdge = incomingEdges[0];
        if (firstEdge && startCursor) {
          firstEdge.cursor = startCursor;
        }
        const lastEdge = incomingEdges[incomingEdges.length - 1];
        if (lastEdge && endCursor) {
          lastEdge.cursor = endCursor;
        }
      }

      let prefix = existing.edges;
      let suffix: typeof prefix = [];

      if (args && args.after) {
        // This comparison does not need to use readField("cursor", edge),
        // because we stored the cursor field of any Reference edges as an
        // extra property of the Reference object.
        const index = prefix.findIndex(edge => edge.cursor === args.after);
        if (index >= 0) {
          prefix = prefix.slice(0, index + 1);
          // suffix = []; // already true
        }
      } else if (args && args.before) {
        const index = prefix.findIndex(edge => edge.cursor === args.before);
        suffix = index < 0 ? prefix : prefix.slice(index);
        prefix = [];
      } else if (incoming.edges) {
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

      const firstEdge = edges[0];
      const lastEdge = edges[edges.length - 1];

      const pageInfo: TPageInfo = {
        ...incoming.pageInfo,
        ...existing.pageInfo,
        startCursor: firstEdge && firstEdge.cursor || "",
        endCursor: lastEdge && lastEdge.cursor || "",
      };

      if (incoming.pageInfo) {
        const { hasPreviousPage, hasNextPage } = incoming.pageInfo;
        // Keep existing.pageInfo.has{Previous,Next}Page unless the
        // placement of the incoming edges means incoming.hasPreviousPage
        // or incoming.hasNextPage should become the new values for those
        // properties in existing.pageInfo.
        if (!prefix.length && hasPreviousPage !== void 0) {
          pageInfo.hasPreviousPage = hasPreviousPage;
        }
        if (!suffix.length && hasNextPage !== void 0) {
          pageInfo.hasNextPage = hasNextPage;
        }
      }

      return {
        ...getExtras(existing),
        ...getExtras(incoming),
        edges,
        pageInfo,
      };
    },
  };
}

// Returns any unrecognized properties of the given object.
const getExtras = (obj: Record<string, any>) => __rest(obj, notExtras);
const notExtras = ["edges", "pageInfo"];

function makeEmptyData(): TExistingRelay<any> {
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
