import type { DocumentNode, FieldNode } from "graphql";
import { wrap } from "optimism";
import type { Observable } from "rxjs";
import { from, mergeMap, of } from "rxjs";

import type { DefaultContext } from "@apollo/client";
import type {
  ApolloContext,
  FetchResult,
  NextLink,
  Operation,
} from "@apollo/client/link/core";
import { ApolloLink } from "@apollo/client/link/core";
import type { FragmentMap, Merge } from "@apollo/client/utilities";
import {
  AutoCleanedWeakCache,
  cacheSizes,
  hasDirectives,
  removeDirectivesFromDocument,
} from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { invariant } from "@apollo/client/utilities/invariant";

import { defaultCacheSizes } from "../../utilities/caching/sizes.js";

import { LocalState } from "./LocalState.js";

export declare namespace LocalResolversLink {
  export interface Options {
    resolvers: Resolvers;
  }

  export interface Resolvers {
    [typename: string]: {
      [field: string]: Resolver;
    };
  }

  export type Resolver = (
    rootValue: any,
    args: any,
    context: Merge<DefaultContext, ApolloContext>,
    info: {
      field: FieldNode;
      fragmentMap: FragmentMap;
    }
  ) => any;
}

interface TransformCacheEntry {
  serverQuery: DocumentNode | null;
  clientQuery: DocumentNode | null;
}

export class LocalResolversLink extends ApolloLink {
  private localState: LocalState;
  private transformCache = new AutoCleanedWeakCache<
    DocumentNode,
    TransformCacheEntry
  >(
    1000 // TODO: Update to use internal memory mechanism
  );

  constructor(options: LocalResolversLink.Options) {
    super();
    this.localState = new LocalState({ resolvers: options.resolvers });
  }

  addResolvers(resolvers: LocalResolversLink.Resolvers) {
    this.localState.addResolvers(resolvers);
  }

  override request(
    operation: Operation,
    forward?: NextLink
  ): Observable<FetchResult> {
    const { clientQuery, serverQuery } = getTransformedQuery(operation.query);

    invariant(
      clientQuery || serverQuery,
      "`LocalResolversLink` was issued a query that could neither be run by local resolvers or the server. Please file an issue as this should be an impossible state."
    );

    let remoteObservable: Observable<FetchResult> = of({ data: {} });

    if (serverQuery) {
      invariant(
        !!forward,
        "`LocalResolversLink` must not be a terminating link when there are non-`@client` fields in the query"
      );

      operation.query = serverQuery;
      remoteObservable = forward(operation);
    }

    return remoteObservable.pipe(
      mergeMap((result) => {
        return from(
          this.localState.runResolvers({
            document: clientQuery,
            remoteResult: result,
            context: {
              ...operation.getContext(),
              ...operation.getApolloContext(),
            },
            variables: operation.variables,
          })
        );
      })
    );
  }
}

const getTransformedQuery = wrap(
  (query: DocumentNode) => {
    return {
      clientQuery: hasDirectives(["client"], query) ? query : null,
      serverQuery: removeDirectivesFromDocument(
        [{ name: "client", remove: true }],
        query
      ),
    };
  },
  {
    max:
      cacheSizes["LocalResolversLink.getTransformedQuery"] ||
      defaultCacheSizes["LocalResolversLink.getTransformedQuery"],
  }
);

if (__DEV__) {
  Object.assign(LocalResolversLink, {
    getMemoryInternals() {
      return {
        LocalResolversLink: {
          getTransformedQuery: getTransformedQuery.size,
        },
      };
    },
  });
}
