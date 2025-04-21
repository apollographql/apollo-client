import type { FieldNode } from "graphql";

import type { DefaultContext } from "@apollo/client";
import type { ApolloContext } from "@apollo/client/link/core";
import { ApolloLink } from "@apollo/client/link/core";
import type { FragmentMap, Merge } from "@apollo/client/utilities";

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

export class LocalResolversLink extends ApolloLink {
  constructor(options: LocalResolversLink.Options) {
    super();
  }
}
