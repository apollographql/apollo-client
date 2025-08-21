/* eslint-disable import/order */



const queryRef: QueryRef = {} as any;
const queryOptions: useQuery.Options = {} as any;

import type { QueryRef, useLoadableQuery } from "@apollo/client/react";
const providerProps: ApolloProvider.Props = {} as any;

import type { ErrorLink } from "@apollo/client/link/error";
const response: ErrorLink.ErrorHandlerOptions = {} as any;

import { getApolloContext, ApolloProvider, useQuery } from "@apollo/client/react";
import { omitDeep } from "@apollo/client/utilities/internal";

import type { SetContextLink } from "@apollo/client/link/context";
const contextSetter: SetContextLink.LegacyContextSetter = (() => {}) as any;
