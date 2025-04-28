/* eslint-disable */
import { LocalResolversLink } from "@apollo/client/link/local-resolvers";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
export type { ResolverFn };
type ResolverFn<
  TResult,
  TParent = unknown,
  TArgs = Record<string, unknown>,
> = LocalResolversLink.Resolver<TResult, TParent, TArgs>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  Date: { input: any; output: any };
};

export type User = {
  __typename: "User";
  lastLoggedInAt?: Maybe<Scalars["Date"]["output"]>;
};

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type Resolver<
  TResult,
  TParent = Record<string, unknown>,
  TArgs = Record<string, unknown>,
> = ResolverFn<TResult, TParent, TArgs>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Boolean: ResolverTypeWrapper<Scalars["Boolean"]["output"]>;
  Date: ResolverTypeWrapper<Scalars["Date"]["output"]>;
  String: ResolverTypeWrapper<Scalars["String"]["output"]>;
  User: ResolverTypeWrapper<User>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Boolean: Scalars["Boolean"]["output"];
  Date: Scalars["Date"]["output"];
  String: Scalars["String"]["output"];
  User: User;
};

export type UserResolvers<
  ParentType extends
    ResolversParentTypes["User"] = ResolversParentTypes["User"],
> = {
  lastLoggedInAt?: Resolver<Maybe<ResolversTypes["Date"]>, ParentType>;
};

export type Resolvers = {
  User?: UserResolvers;
};
