/* eslint-disable */
import * as BaseSchemaTypes from "./base-types.js";
import { LocalState } from "@apollo/client/local-state";
import { DeepPartial } from "@apollo/client/utilities";
import { DefaultContext } from "@apollo/client";
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

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Boolean: Scalars["Boolean"]["output"];
  Food: Food;
  FoodCategory: FoodCategory;
  ID: Scalars["ID"]["output"];
  Int: Scalars["Int"]["output"];
  Query: {};
  String: Scalars["String"]["output"];
  User: User;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Boolean: Scalars["Boolean"]["output"];
  Food: Food;
  ID: Scalars["ID"]["output"];
  Int: Scalars["Int"]["output"];
  Query: Omit<DeepPartial<BaseSchemaTypes.Query>, "currentUserId">;
  String: Scalars["String"]["output"];
  User: Omit<DeepPartial<BaseSchemaTypes.User>, "isLoggedIn" | "favoriteFood">;
};

export type FoodResolvers = {
  categories?: LocalState.Resolver<
    Maybe<Array<ResolversTypes["FoodCategory"]>>,
    ResolversParentTypes["Food"],
    DefaultContext,
    RequireFields<FoodCategoriesArgs, "offset">
  >;
  name?: LocalState.Resolver<
    Maybe<ResolversTypes["String"]>,
    ResolversParentTypes["Food"],
    DefaultContext
  >;
};

export type QueryResolvers = {
  currentUserId?: LocalState.Resolver<
    Maybe<ResolversTypes["ID"]>,
    ResolversParentTypes["Query"],
    DefaultContext
  >;
};

export type UserResolvers = {
  favoriteFood?: LocalState.Resolver<
    Maybe<ResolversTypes["Food"]>,
    ResolversParentTypes["User"],
    DefaultContext
  >;
  isLoggedIn?: LocalState.Resolver<
    ResolversTypes["Boolean"],
    ResolversParentTypes["User"],
    DefaultContext
  >;
};

export type Resolvers = {
  Food?: FoodResolvers;
  Query?: QueryResolvers;
  User?: UserResolvers;
};
