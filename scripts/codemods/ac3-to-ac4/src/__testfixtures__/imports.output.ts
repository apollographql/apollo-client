/* eslint-disable import/order */



const queryRef: QueryRef = {} as any;
const queryOptions: useQuery.Options = {} as any;

const providerProps: ApolloProvider.Props = {} as any;

import type { ErrorLink } from "@apollo/client/link/error";
const response: ErrorLink.ErrorHandlerOptions = {} as any;

import { getApolloContext, QueryRef, ApolloProvider, useQuery, useLoadableQuery } from "@apollo/client/react";
import { omitDeep } from "@apollo/client/utilities/internal";
import type { SetContextLink } from "@apollo/client/link/context";
const contextSetter: SetContextLink.LegacyContextSetter = (() => {}) as any;
