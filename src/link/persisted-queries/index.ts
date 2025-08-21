import type {
  DocumentNode,
  FormattedExecutionResult,
  GraphQLFormattedError,
} from "graphql";
import type { Observer, Subscription } from "rxjs";
import { Observable } from "rxjs";

import type { ErrorLike } from "@apollo/client";
import {
  CombinedGraphQLErrors,
  ServerError,
  toErrorLike,
} from "@apollo/client/errors";
import { ApolloLink } from "@apollo/client/link";
import { print } from "@apollo/client/utilities";
import {
  cacheSizes,
  isFormattedExecutionResult,
} from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import {
  AutoCleanedWeakCache,
  compact,
  isNonEmptyArray,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

import { defaultCacheSizes } from "../../utilities/caching/sizes.js";

export const VERSION = 1;

export declare namespace PersistedQueryLink {
  namespace PersistedQueryLinkDocumentationTypes {
    /**
     * A SHA-256 hash function for hashing query strings.
     *
     * @param queryString - The query string to hash
     * @returns The SHA-256 hash or a promise that resolves to the SHA-256 hash
     *
     * @example
     *
     * ```ts
     * import { sha256 } from "crypto-hash";
     *
     * const link = new PersistedQueryLink({ sha256 });
     * ```
     */
    function SHA256Function(queryString: string): string | PromiseLike<string>;

    /**
     * A function that generates a hash for a GraphQL document.
     *
     * @param document - The GraphQL document to hash
     * @returns The hash string or a promise that resolves to the hash string
     *
     * @example
     *
     * ```ts
     * import { print } from "graphql";
     * import { sha256 } from "crypto-hash";
     *
     * const link = new PersistedQueryLink({
     *   generateHash: async (document) => {
     *     const query = print(document);
     *     return sha256(query);
     *   },
     * });
     * ```
     */
    function GenerateHashFunction(
      document: DocumentNode
    ): string | PromiseLike<string>;
  }

  namespace Base {
    /**
     * Base options shared between SHA256 and custom hash configurations.
     */
    interface Options {
      /**
       * A function to disable persisted queries for the current session.
       *
       * This function is called when an error occurs and determines whether
       * to disable persisted queries for all future requests in this session.
       *
       * @defaultValue Disables on `PersistedQueryNotSupported` errors
       */
      disable?: (options: PersistedQueryLink.DisableFunctionOptions) => boolean;

      /**
       * A function to determine whether to retry a request with the full query.
       *
       * When a persisted query fails, this function determines whether to
       * retry the request with the full query text included.
       *
       * @defaultValue Retries on `PersistedQueryNotSupported` or `PersistedQueryNotFound` errors
       */
      retry?: (options: PersistedQueryLink.RetryFunctionOptions) => boolean;

      /**
       * Whether to use HTTP GET for hashed queries (excluding mutations).
       *
       * > [!NOTE]
       * > If you want to use `GET` for non-mutation queries whether or not they
       * > are hashed, pass `useGETForQueries: true` option to `HttpLink`
       * > instead. If you want to use GET for all requests, pass `fetchOptions: {method: 'GET'}`
       * > to `HttpLink`.
       *
       * @defaultValue `false`
       */
      useGETForHashedQueries?: boolean;
    }
  }

  /**
   * Metadata about persisted query errors extracted from the response.
   */
  export interface ErrorMeta {
    /**
     * Whether the server responded with a "PersistedQueryNotSupported" error.
     *
     * When `true`, indicates the server doesn't support persisted queries
     * or has disabled them for this client.
     */
    persistedQueryNotSupported: boolean;

    /**
     * Whether the server responded with a "PersistedQueryNotFound" error.
     *
     * When `true`, indicates the server doesn't recognize the query hash
     * and needs the full query text.
     */
    persistedQueryNotFound: boolean;
  }

  /** {@inheritDoc @apollo/client/link/persisted-queries!PersistedQueryLink.PersistedQueryLinkDocumentationTypes.GenerateHashFunction:function(1)} */
  export type GenerateHashFunction = (
    document: DocumentNode
  ) => string | PromiseLike<string>;

  /** {@inheritDoc @apollo/client/link/persisted-queries!PersistedQueryLink.PersistedQueryLinkDocumentationTypes.SHA256Function:function(1)} */
  export type SHA256Function = (
    queryString: string
  ) => string | PromiseLike<string>;

  /**
   * Options for using SHA-256 hashing with persisted queries.
   *
   * Use this configuration when you want the link to handle query
   * printing and hashing using a SHA-256 function.
   */
  export interface SHA256Options extends Base.Options {
    /**
     * The SHA-256 hash function to use for hashing queries. This function
     * receives the printed query string and should return a SHA-256 hash. Can
     * be synchronous or asynchronous.
     */
    sha256: PersistedQueryLink.SHA256Function;
    generateHash?: never;
  }

  /**
   * Options for using custom hash generation with persisted queries.
   *
   * Use this configuration when you need custom control over how
   * query hashes are generated (e.g., using pre-computed hashes).
   */
  export interface GenerateHashOptions extends Base.Options {
    sha256?: never;
    /**
     * A custom function for generating query hashes. This function receives
     * the GraphQL document and should return a hash. Useful for custom hashing
     * strategies or when using build-time generated hashes.
     */
    generateHash: PersistedQueryLink.GenerateHashFunction;
  }

  /**
   * Configuration options for creating a `PersistedQueryLink`.
   *
   * You must provide either a `sha256` function or a custom `generateHash`
   * function, but not both.
   */
  export type Options =
    | PersistedQueryLink.SHA256Options
    | PersistedQueryLink.GenerateHashOptions;

  /**
   * Options passed to the `retry` function when a persisted query request
   * fails.
   */
  export interface RetryFunctionOptions {
    /**
     * The error that occurred during the request.
     */
    error: ErrorLike;

    /**
     * The GraphQL operation that failed.
     */
    operation: ApolloLink.Operation;

    /**
     * Metadata about the persisted query error.
     */
    meta: PersistedQueryLink.ErrorMeta;

    /**
     * The GraphQL result, if available.
     */
    result?: FormattedExecutionResult;
  }

  /**
   * Options passed to the `disable` function when a persisted query request
   * fails.
   */
  export interface DisableFunctionOptions
    extends PersistedQueryLink.RetryFunctionOptions {}
}

function processErrors(
  graphQLErrors:
    | GraphQLFormattedError[]
    | ReadonlyArray<GraphQLFormattedError>
    | undefined
): PersistedQueryLink.ErrorMeta {
  const byMessage: Record<string, GraphQLFormattedError> = {},
    byCode: Record<string, GraphQLFormattedError> = {};

  if (isNonEmptyArray(graphQLErrors)) {
    graphQLErrors.forEach((error) => {
      byMessage[error.message] = error;
      if (typeof error.extensions?.code == "string")
        byCode[error.extensions.code] = error;
    });
  }
  return {
    persistedQueryNotSupported: !!(
      byMessage.PersistedQueryNotSupported ||
      byCode.PERSISTED_QUERY_NOT_SUPPORTED
    ),
    persistedQueryNotFound: !!(
      byMessage.PersistedQueryNotFound || byCode.PERSISTED_QUERY_NOT_FOUND
    ),
  };
}

const defaultOptions: Required<PersistedQueryLink.Base.Options> = {
  disable: ({ meta }) => meta.persistedQueryNotSupported,
  retry: ({ meta }) =>
    meta.persistedQueryNotSupported || meta.persistedQueryNotFound,
  useGETForHashedQueries: false,
};

function operationDefinesMutation(operation: ApolloLink.Operation) {
  return operation.query.definitions.some(
    (d) => d.kind === "OperationDefinition" && d.operation === "mutation"
  );
}

/**
 * @deprecated
 * Use `PersistedQueryLink` from `@apollo/client/link/persisted-queries` instead.
 */
export const createPersistedQueryLink = (options: PersistedQueryLink.Options) =>
  new PersistedQueryLink(options);

/**
 * `PersistedQueryLink` is a non-terminating link that enables the use of
 * persisted queries, a technique that reduces bandwidth by sending query hashes
 * instead of full query strings.
 *
 * @example
 *
 * ```ts
 * import { PersistedQueryLink } from "@apollo/client/link/persisted-queries";
 * import { sha256 } from "crypto-hash";
 *
 * const link = new PersistedQueryLink({
 *   sha256: (queryString) => sha256(queryString),
 * });
 * ```
 */
export class PersistedQueryLink extends ApolloLink {
  constructor(options: PersistedQueryLink.Options) {
    let hashesByQuery:
      | AutoCleanedWeakCache<DocumentNode, Promise<string>>
      | undefined;
    function resetHashCache() {
      hashesByQuery = undefined;
    }
    // Ensure a SHA-256 hash function is provided, if a custom hash
    // generation function is not provided. We don't supply a SHA-256 hash
    // function by default, to avoid forcing one as a dependency. Developers
    // should pick the most appropriate SHA-256 function (sync or async) for
    // their needs/environment, or provide a fully custom hash generation
    // function (via the `generateHash` option) if they want to handle
    // hashing with something other than SHA-256.
    invariant(
      options &&
        (typeof options.sha256 === "function" ||
          typeof options.generateHash === "function"),
      'Missing/invalid "sha256" or "generateHash" function. Please ' +
        'configure one using the "createPersistedQueryLink(options)" options ' +
        "parameter."
    );

    const {
      sha256,
      // If both a `sha256` and `generateHash` option are provided, the
      // `sha256` option will be ignored. Developers can configure and
      // use any hashing approach they want in a custom `generateHash`
      // function; they aren't limited to SHA-256.
      generateHash = (query: DocumentNode) =>
        Promise.resolve<string>(sha256!(print(query))),
      disable,
      retry,
      useGETForHashedQueries,
    } = compact(defaultOptions, options);

    let enabled = true;

    const getHashPromise = (query: DocumentNode) =>
      new Promise<string>((resolve) => resolve(generateHash(query)));

    function getQueryHash(query: DocumentNode): Promise<string> {
      if (!query || typeof query !== "object") {
        // If the query is not an object, we won't be able to store its hash as
        // a property of query[hashesKey], so we let generateHash(query) decide
        // what to do with the bogus query.
        return getHashPromise(query);
      }
      if (!hashesByQuery) {
        hashesByQuery = new AutoCleanedWeakCache(
          cacheSizes["PersistedQueryLink.persistedQueryHashes"] ||
            defaultCacheSizes["PersistedQueryLink.persistedQueryHashes"]
        );
      }
      let hash = hashesByQuery.get(query);
      if (!hash) hashesByQuery.set(query, (hash = getHashPromise(query)));
      return hash;
    }

    super((operation, forward) => {
      invariant(
        forward,
        "PersistedQueryLink cannot be the last link in the chain."
      );

      const { query } = operation;

      return new Observable((observer) => {
        let subscription: Subscription | undefined;
        let retried = false;
        let originalFetchOptions: any;
        let setFetchOptions = false;

        function handleRetry(
          options: PersistedQueryLink.RetryFunctionOptions,
          cb: () => void
        ) {
          if (retried) {
            return cb();
          }

          retried = true;

          // if the server doesn't support persisted queries, don't try anymore
          enabled = !disable(options);
          if (!enabled) {
            delete operation.extensions.persistedQuery;
            // clear hashes from cache, we don't need them anymore
            resetHashCache();
          }

          // if its not found, we can try it again, otherwise just report the error
          if (retry(options)) {
            // need to recall the link chain
            if (subscription) subscription.unsubscribe();
            // actually send the query this time
            operation.setContext({
              http: {
                includeQuery: true,
                ...(enabled ? { includeExtensions: true } : {}),
              },
              fetchOptions: {
                // Since we're including the full query, which may be
                // large, we should send it in the body of a POST request.
                // See issue #7456.
                method: "POST",
              },
            });
            if (setFetchOptions) {
              operation.setContext({ fetchOptions: originalFetchOptions });
            }
            subscription = forward(operation).subscribe(handler);

            return;
          }

          cb();
        }

        const handler: Observer<ApolloLink.Result> = {
          next: (result) => {
            if (!isFormattedExecutionResult(result) || !result.errors) {
              return observer.next(result);
            }

            handleRetry(
              {
                operation,
                error: new CombinedGraphQLErrors(result),
                meta: processErrors(result.errors),
                result,
              },
              () => observer.next(result)
            );
          },
          error: (incomingError) => {
            const error = toErrorLike(incomingError);
            const callback = () => observer.error(incomingError);

            // This is persisted-query specific (see #9410) and deviates from the
            // GraphQL-over-HTTP spec for application/json responses.
            // This is intentional.
            if (ServerError.is(error) && error.bodyText) {
              try {
                const result = JSON.parse(error.bodyText);

                if (isFormattedExecutionResult(result)) {
                  return handleRetry(
                    {
                      error: new CombinedGraphQLErrors(result),
                      result,
                      operation,
                      meta: processErrors(result.errors),
                    },
                    callback
                  );
                }
              } catch {}
            }

            handleRetry(
              {
                error,
                operation,
                meta: {
                  persistedQueryNotSupported: false,
                  persistedQueryNotFound: false,
                },
              },
              callback
            );
          },
          complete: observer.complete.bind(observer),
        };

        // don't send the query the first time
        operation.setContext({
          http: enabled ? { includeQuery: false, includeExtensions: true } : {},
        });

        // If requested, set method to GET if there are no mutations. Remember the
        // original fetchOptions so we can restore them if we fall back to a
        // non-hashed request.
        if (
          useGETForHashedQueries &&
          enabled &&
          !operationDefinesMutation(operation)
        ) {
          operation.setContext(
            ({ fetchOptions = {} }: { fetchOptions: Record<string, any> }) => {
              originalFetchOptions = fetchOptions;
              return {
                fetchOptions: {
                  ...fetchOptions,
                  method: "GET",
                },
              };
            }
          );
          setFetchOptions = true;
        }

        if (enabled) {
          getQueryHash(query)
            .then((sha256Hash) => {
              operation.extensions.persistedQuery = {
                version: VERSION,
                sha256Hash,
              };
              subscription = forward(operation).subscribe(handler);
            })
            .catch(observer.error!.bind(observer));
        } else {
          subscription = forward(operation).subscribe(handler);
        }

        return () => {
          if (subscription) subscription.unsubscribe();
        };
      });
    });
    if (__DEV__) {
      Object.assign(this, {
        getMemoryInternals() {
          return {
            PersistedQueryLink: {
              persistedQueryHashes: hashesByQuery?.size ?? 0,
            },
          };
        },
      });
    }
    this.resetHashCache = resetHashCache;
  }

  resetHashCache: () => void;
}
