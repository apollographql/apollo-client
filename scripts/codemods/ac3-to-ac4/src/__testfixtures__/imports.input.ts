/* eslint-disable import/order */

import type { QueryReference, QueryHookOptions } from "@apollo/client";
const queryRef: QueryReference = {} as any;
const queryOptions: QueryHookOptions = {} as any;

import type { ApolloProviderProps } from "@apollo/client/react";
const providerProps: ApolloProviderProps = {} as any;

import type { ErrorResponse } from "@apollo/client/link/error";
const response: ErrorResponse = {} as any;

import { useQuery, ApolloProvider } from "@apollo/client";

import type { LoadQueryFunction } from "@apollo/client";

import { getApolloContext } from "@apollo/client/react/context";

import { omitDeep } from "@apollo/client/utilities";

import type { ContextSetter } from "@apollo/client/link/context";
const contextSetter: ContextSetter = (() => {}) as any;
