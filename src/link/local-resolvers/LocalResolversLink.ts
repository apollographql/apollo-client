import type { FieldNode } from "graphql";

import { ApolloLink } from "@apollo/client/link/core";
import type { FragmentMap } from "@apollo/client/utilities";

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
    rootValue?: any,
    args?: any,
    context?: any,
    info?: {
      field: FieldNode;
      fragmentMap: FragmentMap;
    }
  ) => any;
}

export class LocalResolversLink extends ApolloLink {
  constructor(options: LocalResolversLink.Options) {
    super();
  }
}
