import { ApolloCache } from 'apollo-cache';
import { InMemoryCache, NormalizedCacheObject } from 'apollo-cache-inmemory';
import { onError } from 'apollo-link-error';
import { ApolloLink, Operation, NextLink } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import { GraphQLError } from 'graphql';

import { ApolloClientOptions } from '../ApolloClient';
import { Observable } from '../util/Observable';

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

  public getRequestHandler() {
    const { request } = this.options;
    let requestHandler = null;
    if (!this.disableDefaults) {
      requestHandler = request
        ? new ApolloLink(
            (operation: Operation, forward: NextLink) =>
              new Observable(observer => {
                let handle: any;
                Promise.resolve(operation)
                  .then(oper => request(oper))
                  .then(() => {
                    handle = forward(operation).subscribe({
                      next: observer.next.bind(observer),
                      error: observer.error.bind(observer),
                      complete: observer.complete.bind(observer),
                    });
                  })
                  .catch(observer.error.bind(observer));

                return () => {
                  if (handle) {
                    handle.unsubscribe();
                  }
                };
              }),
          )
        : null;
    }
    return requestHandler;
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
        this.getRequestHandler(),
        this.getHttpLink(),
      ].filter(n => n);
      link = ApolloLink.from(links as ApolloLink[]);
    }
    return link;
  }
}
