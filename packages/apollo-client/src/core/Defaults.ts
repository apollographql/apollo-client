import { ApolloCache } from 'apollo-cache';
import { InMemoryCache, NormalizedCacheObject } from 'apollo-cache-inmemory';
import { onError } from 'apollo-link-error';
import { ApolloLink } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import { GraphQLError } from 'graphql';

import { ApolloClientOptions } from '../ApolloClient';

export interface ErrorResponse {
  graphQLErrors?: ReadonlyArray<GraphQLError>;
  networkError?: Error;
}

export default class Defaults<TCacheShape> {
  public options: ApolloClientOptions<TCacheShape> = {};
  public disableDefaults: boolean = false;

  constructor(options: ApolloClientOptions<TCacheShape>) {
    this.options = options;
    this.disableDefaults = !!options.disableDefaults;
  }

  public getCache() {
    return new InMemoryCache() as ApolloCache<NormalizedCacheObject>;
  }

  public getErrorLink() {
    return this.disableDefaults
      ? null
      : onError(({ graphQLErrors, networkError }: ErrorResponse) => {
          if (graphQLErrors) {
            graphQLErrors.map(({ message, locations, path }: GraphQLError) => {
              console.log(
                `[GraphQL error]: Message: ${message}, ` +
                  `Location: ${locations}, Path: ${path}`,
              );
            });
          }
          if (networkError) {
            console.log(`[Network error]: ${networkError}`);
          }
        });
  }

  public getHttpLink() {
    return this.disableDefaults
      ? null
      : new HttpLink({
          uri: this.options.uri || '/graphql',
        });
  }

  public getLink() {
    let link = null;
    if (!this.disableDefaults) {
      const links: (ApolloLink | null)[] = [
        this.getErrorLink(),
        this.getHttpLink(),
      ].filter(n => n);
      link = ApolloLink.from(links as ApolloLink[]);
    }
    return link;
  }
}
