/* eslint-disable */
import { LocalState } from "@apollo/client/local-state";
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
type ResolverFn<
  TResult,
  TParent = unknown,
  TArgs = Record<string, unknown>,
> = LocalState.Resolver<TResult, TParent, TArgs>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>;
};
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
};

export type Food = {
  __typename: "Food";
  categories?: Maybe<Array<FoodCategory>>;
  name?: Maybe<Scalars["String"]["output"]>;
};

export type FoodCategoriesArgs = {
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset: Scalars["Int"]["input"];
};

export enum FoodCategory {
  Italian = "ITALIAN",
}

export type Query = {
  __typename: "Query";
  currentUserId?: Maybe<Scalars["ID"]["output"]>;
};

export type User = {
  __typename: "User";
  favoriteFood?: Maybe<Food>;
  isLoggedIn: Scalars["Boolean"]["output"];
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
  Food: ResolverTypeWrapper<Food>;
  FoodCategory: FoodCategory;
  ID: ResolverTypeWrapper<Scalars["ID"]["output"]>;
  Int: ResolverTypeWrapper<Scalars["Int"]["output"]>;
  Query: ResolverTypeWrapper<undefined>;
  String: ResolverTypeWrapper<Scalars["String"]["output"]>;
  User: ResolverTypeWrapper<User>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Boolean: Scalars["Boolean"]["output"];
  Food: Food;
  ID: Scalars["ID"]["output"];
  Int: Scalars["Int"]["output"];
  Query: undefined;
  String: Scalars["String"]["output"];
  User: User;
};

export type FoodResolvers<
  ParentType extends
    ResolversParentTypes["Food"] = ResolversParentTypes["Food"],
> = {
  categories?: LocalState.Resolver<
    Maybe<Array<ResolversTypes["FoodCategory"]>>,
    ParentType,
    RequireFields<FoodCategoriesArgs, "offset">
  >;
  name?: LocalState.Resolver<Maybe<ResolversTypes["String"]>, ParentType>;
};

export type QueryResolvers<
  ParentType extends
    ResolversParentTypes["Query"] = ResolversParentTypes["Query"],
> = {
  currentUserId?: LocalState.Resolver<Maybe<ResolversTypes["ID"]>, ParentType>;
};

export type UserResolvers<
  ParentType extends
    ResolversParentTypes["User"] = ResolversParentTypes["User"],
> = {
  favoriteFood?: LocalState.Resolver<Maybe<ResolversTypes["Food"]>, ParentType>;
  isLoggedIn?: LocalState.Resolver<ResolversTypes["Boolean"], ParentType>;
};

export type Resolvers = {
  Food?: FoodResolvers;
  Query?: QueryResolvers;
  User?: UserResolvers;
};
