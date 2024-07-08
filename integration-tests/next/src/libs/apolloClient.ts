import * as React from "react";
import type { NormalizedCacheObject } from "@apollo/client";
import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  from,
  ApolloLink,
  Observable,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import merge from "deepmerge";
import isEqual from "lodash/isEqual";
import type { GetServerSidePropsResult } from "next";
import { schemaLink } from "./schemaLink.ts";

export const APOLLO_STATE_PROP_NAME = "__APOLLO_STATE__";

let apolloClient: ApolloClient<NormalizedCacheObject>;

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors)
    graphQLErrors.forEach(({ message, locations, path }) =>
      console.log(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      )
    );
  if (networkError) console.log(`[Network error]: ${networkError}`);
});

const delayLink = new ApolloLink((operation, forward) => {
  return new Observable((observer) => {
    const handle = setTimeout(() => {
      forward(operation).subscribe(observer);
    }, 1000);

    return () => clearTimeout(handle);
  });
});

const httpLink = new HttpLink({
  uri: "https://main--hack-the-e-commerce.apollographos.net/graphql",
});

function createApolloClient() {
  return new ApolloClient({
    ssrMode: typeof window === "undefined",
    link: from([
      errorLink,
      delayLink,
      typeof window === "undefined" ?
        (schemaLink as ApolloLink)
      : (httpLink as ApolloLink),
    ]),
    cache: new InMemoryCache(),
  });
}

export function initializeApollo(
  initialState: NormalizedCacheObject | null = null
) {
  const _apolloClient = apolloClient ?? createApolloClient();
  // If your page has Next.js data fetching methods that use Apollo Client,
  //  the initial state gets hydrated here
  if (initialState) {
    // Get existing cache, loaded during client side data fetching
    const existingCache = _apolloClient.extract();

    // Merge the initialState from getStaticProps/getServerSideProps
    // in the existing cache
    const data = merge(existingCache, initialState, {
      // combine arrays using object equality (like in sets)
      arrayMerge: (destinationArray, sourceArray) => [
        ...sourceArray,
        ...destinationArray.filter((d) =>
          sourceArray.every((s) => !isEqual(d, s))
        ),
      ],
    });
    // Restore the cache with the merged data
    _apolloClient.cache.restore(data);
  }
  // For SSG and SSR always create a new Apollo Client
  if (typeof window === "undefined") return _apolloClient;
  // Create the Apollo Client once in the client
  if (!apolloClient) apolloClient = _apolloClient;
  return _apolloClient;
}

interface ApolloProps {
  [APOLLO_STATE_PROP_NAME]: NormalizedCacheObject;
}

export function addApolloState(
  client: ApolloClient<NormalizedCacheObject>,
  pageProps: GetServerSidePropsResult<Partial<ApolloProps>> & {
    props: Partial<ApolloProps>;
  }
) {
  if (pageProps?.props) {
    pageProps.props[APOLLO_STATE_PROP_NAME] = client.cache.extract();
  }
  return pageProps;
}

export function useApollo(pageProps?: ApolloProps) {
  const state = pageProps?.[APOLLO_STATE_PROP_NAME];
  const storeRef = React.useRef<ApolloClient<NormalizedCacheObject>>();
  if (!storeRef.current) {
    storeRef.current = initializeApollo(state);
  }
  return storeRef.current;
}
