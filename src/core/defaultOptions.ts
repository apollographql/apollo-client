import type { ApolloClient } from "@apollo/client";
import type { Prettify } from "@apollo/client/utilities/internal";

export declare namespace DeclareDefaultOptions {
  export interface WatchQuery {}
  export interface Query {}
  export interface Mutate {}
}

type PropertiesWithChildRequiredKeys<T extends Record<string, unknown>> =
  keyof T extends infer K ?
    K extends keyof T ?
      {} extends T[K] ?
        never
      : K
    : never
  : never;

type RequirePropertiesWithChildRequiredKeys<T extends Record<string, unknown>> =
  Prettify<T & Pick<Required<T>, PropertiesWithChildRequiredKeys<T>>>;

export interface DefaultOptionsParentObject
  extends RequirePropertiesWithChildRequiredKeys<{
    /**
     * Provide this object to set application-wide default values for options you can provide to the `watchQuery`, `query`, and `mutate` functions. See below for an example object.
     *
     * See this [example object](https://www.apollographql.com/docs/react/api/core/ApolloClient#example-defaultoptions-object).
     */
    defaultOptions?: ApolloClient.DefaultOptions.Input;
  }> {}

/**
 * Possible default options for ApolloClient instances.
 */
// This is the calculated type from any possible additions to `DeclareDefaultOptions`.
export interface DefaultOptions {
  watchQuery?: DefaultOptions.WatchQuery;
  query?: DefaultOptions.Query;
  mutate?: DefaultOptions.Mutate;
}

export declare namespace DefaultOptions {
  export interface Input
    extends RequirePropertiesWithChildRequiredKeys<{
      watchQuery?: DefaultOptions.WatchQuery.Input;
      query?: DefaultOptions.Query.Input;
      mutate?: DefaultOptions.Mutate.Input;
    }> {}

  type _WatchQuery = DefaultOptions.WatchQuery.Input &
    PossibleDefaultOptions.WatchQuery;
  export interface WatchQuery extends _WatchQuery {}
  export namespace WatchQuery {
    export type Calculated = Calculate<
      ApolloClient.DeclareDefaultOptions.WatchQuery,
      {
        errorPolicy: "none";
        returnPartialData: false;
      }
    >;

    export interface Input
      extends RequireDefaultOptionDeclarations<
        PossibleDefaultOptions.WatchQuery,
        DeclareDefaultOptions.WatchQuery,
        "watchQuery",
        "errorPolicy" | "returnPartialData"
      > {}
  }

  type _Query = DefaultOptions.Query.Input & PossibleDefaultOptions.Query;
  export interface Query extends _Query {}
  export namespace Query {
    export type Calculated = Calculate<
      ApolloClient.DeclareDefaultOptions.Query,
      {
        errorPolicy: "none";
      }
    >;

    export interface Input
      extends RequireDefaultOptionDeclarations<
        PossibleDefaultOptions.Query,
        DeclareDefaultOptions.Query,
        "query",
        "errorPolicy"
      > {}
  }

  type _Mutate = DefaultOptions.Mutate.Input & PossibleDefaultOptions.Mutate;
  export interface Mutate extends _Mutate {}
  export namespace Mutate {
    export type Calculated = Calculate<
      ApolloClient.DeclareDefaultOptions.Mutate,
      {
        errorPolicy: "none";
      }
    >;

    export interface Input
      extends RequireDefaultOptionDeclarations<
        PossibleDefaultOptions.Mutate,
        DeclareDefaultOptions.Mutate,
        "mutate",
        "errorPolicy"
      > {}
  }
}

type Calculate<UserDefaults, BaseDefaults> = {
  [K in keyof BaseDefaults]: K extends keyof UserDefaults ?
    undefined extends UserDefaults[K] ?
      BaseDefaults[K] | Exclude<UserDefaults[K], undefined>
    : UserDefaults[K]
  : BaseDefaults[K];
};

/**
 * @internal
 * Exported as `InternalTypes.PossibleDefaultOptions`.
 */
export declare namespace PossibleDefaultOptions {
  export interface WatchQuery
    extends Partial<ApolloClient.WatchQueryOptions<any, any>> {}
  export interface Query extends Partial<ApolloClient.QueryOptions<any, any>> {}
  export interface Mutate
    extends Partial<ApolloClient.MutateOptions<any, any, any>> {}
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
        K} must be declared in ApolloClient.DeclareDefaultOptions before usage. See https://www.apollographql.com/docs/react/data/typescript#declaring-default-options-for-type-safety.`;
    }
>;
