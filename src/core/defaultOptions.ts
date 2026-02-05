import type { Prettify } from "@apollo/client/utilities/internal";

import type { ApolloClient } from "./ApolloClient.js";

export declare namespace DeclareDefaultOptions {
  export interface WatchQuery {}
  export interface Query {}
  export interface Mutate {}
}

type PropertiesWithRequiredKeys<T extends Record<string, unknown>> =
  keyof T extends infer K ?
    K extends keyof T ?
      {} extends T[K] ?
        never
      : K
    : never
  : never;

type RequirePropertiesWithRequiredKeys<T extends Record<string, unknown>> =
  Prettify<T & Pick<Required<T>, PropertiesWithRequiredKeys<T>>>;

/**
 * Possible default options for ApolloClient instances.
 */
// This is the calculated type from any possible additions to `DeclareDefaultOptions`.
export interface DefaultOptions
  extends RequirePropertiesWithRequiredKeys<{
    watchQuery?: DefaultOptions.WatchQuery;
    query?: DefaultOptions.Query;
    mutate?: DefaultOptions.Mutate;
  }> {}
export declare namespace DefaultOptions {
  export interface ParentObject
    extends RequirePropertiesWithRequiredKeys<{
      /**
       * Provide this object to set application-wide default values for options you can provide to the `watchQuery`, `query`, and `mutate` functions. See below for an example object.
       *
       * See this [example object](https://www.apollographql.com/docs/react/api/core/ApolloClient#example-defaultoptions-object).
       */
      defaultOptions?: DefaultOptions;
    }> {}

  export interface WatchQuery
    extends RequireDefaultOptionDeclarations<
      PossibleDefaultOptions.WatchQuery,
      DeclareDefaultOptions.WatchQuery,
      "watchQuery",
      "errorPolicy"
    > {}
  export interface Query
    extends RequireDefaultOptionDeclarations<
      PossibleDefaultOptions.Query,
      DeclareDefaultOptions.Query,
      "query",
      "errorPolicy"
    > {}
  export interface Mutate
    extends RequireDefaultOptionDeclarations<
      PossibleDefaultOptions.Mutate,
      DeclareDefaultOptions.Mutate,
      "mutate",
      "errorPolicy"
    > {}
}

/**
 * @internal
 * Exported as `InternalTypes.PossibleDefaultOptions`.
 */
export declare namespace PossibleDefaultOptions {
  export interface WatchQuery
    extends ApolloClient.WatchQueryOptions<any, any> {}
  export interface Query extends ApolloClient.QueryOptions<any, any> {}
  export interface Mutate extends ApolloClient.MutateOptions<any, any, any> {}
}

type RequireDefaultOptionDeclarations<
  Target,
  DeclarationInterface,
  TargetName extends string,
  RequiredDeclarations extends keyof Target & string,
> = Prettify<
  Partial<
    Omit<Target, Exclude<RequiredDeclarations, keyof DeclarationInterface>>
  > &
    DeclarationInterface & {
      /** Missing declaration in ApolloClient.DeclareDefaultOptions */
      [K in Exclude<
        RequiredDeclarations,
        keyof DeclarationInterface
      >]?: `A default option for ${TargetName}.${string &
        K} must be declared in ApolloClient.DeclareDefaultOptions before usage. See <TODO documentation link>.`;
    }
>;
