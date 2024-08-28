import { invariant } from "../../utilities/globals/index.js";

import { print } from "../../utilities/index.js";
import type {
  DocumentNode,
  FormattedExecutionResult,
  GraphQLFormattedError,
} from "graphql";

import type { Operation } from "../core/index.js";
import { ApolloLink } from "../core/index.js";
import type {
  Observer,
  ObservableSubscription,
} from "../../utilities/index.js";
import { Observable, compact, isNonEmptyArray } from "../../utilities/index.js";
import type { NetworkError } from "../../errors/index.js";
import type { ServerError } from "../utils/index.js";
import {
  cacheSizes,
  AutoCleanedWeakCache,
  defaultCacheSizes,
} from "../../utilities/index.js";

export const VERSION = 1;

export interface ErrorResponse {
  graphQLErrors?: ReadonlyArray<GraphQLFormattedError>;
  networkError?: NetworkError;
  response?: FormattedExecutionResult;
  operation: Operation;
  meta: ErrorMeta;
}

type ErrorMeta = {
  persistedQueryNotSupported: boolean;
  persistedQueryNotFound: boolean;
};

type SHA256Function = (...args: any[]) => string | PromiseLike<string>;
type GenerateHashFunction = (
  document: DocumentNode
) => string | PromiseLike<string>;

interface BaseOptions {
  disable?: (error: ErrorResponse) => boolean;
  retry?: (error: ErrorResponse) => boolean;
  useGETForHashedQueries?: boolean;
}

export namespace PersistedQueryLink {
  interface SHA256Options extends BaseOptions {
    sha256: SHA256Function;
    generateHash?: never;
  }

  interface GenerateHashOptions extends BaseOptions {
    sha256?: never;
    generateHash: GenerateHashFunction;
  }

  export type Options = SHA256Options | GenerateHashOptions;
}

function processErrors(
  graphQLErrors:
    | GraphQLFormattedError[]
    | ReadonlyArray<GraphQLFormattedError>
    | undefined
): ErrorMeta {
  const byMessage = Object.create(null),
    byCode = Object.create(null);

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

const defaultOptions: Required<BaseOptions> = {
  disable: ({ meta }) => meta.persistedQueryNotSupported,
  retry: ({ meta }) =>
    meta.persistedQueryNotSupported || meta.persistedQueryNotFound,
  useGETForHashedQueries: false,
};

function operationDefinesMutation(operation: Operation) {
  return operation.query.definitions.some(
    (d) => d.kind === "OperationDefinition" && d.operation === "mutation"
  );
}

export const createPersistedQueryLink = (
  options: PersistedQueryLink.Options
) => {
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

  let supportsPersistedQueries = true;

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
    let hash = hashesByQuery.get(query)!;
    if (!hash) hashesByQuery.set(query, (hash = getHashPromise(query)));
    return hash;
  }

  return Object.assign(
    new ApolloLink((operation, forward) => {
      invariant(
        forward,
        "PersistedQueryLink cannot be the last link in the chain."
      );

      const { query } = operation;

      return new Observable((observer: Observer<FormattedExecutionResult>) => {
        let subscription: ObservableSubscription;
        let retried = false;
        let originalFetchOptions: any;
        let setFetchOptions = false;
        const maybeRetry = (
          {
            response,
            networkError,
          }: {
            response?: FormattedExecutionResult;
            networkError?: ServerError;
          },
          cb: () => void
        ) => {
          if (!retried && ((response && response.errors) || networkError)) {
            retried = true;

            const graphQLErrors: GraphQLFormattedError[] = [];

            const responseErrors = response && response.errors;
            if (isNonEmptyArray(responseErrors)) {
              graphQLErrors.push(...responseErrors);
            }

            // Network errors can return GraphQL errors on for example a 403
            let networkErrors;
            if (typeof networkError?.result !== "string") {
              networkErrors =
                networkError &&
                networkError.result &&
                (networkError.result.errors as GraphQLFormattedError[]);
            }
            if (isNonEmptyArray(networkErrors)) {
              graphQLErrors.push(...(networkErrors as GraphQLFormattedError[]));
            }

            const disablePayload: ErrorResponse = {
              response,
              networkError,
              operation,
              graphQLErrors:
                isNonEmptyArray(graphQLErrors) ? graphQLErrors : void 0,
              meta: processErrors(graphQLErrors),
            };

            // if the server doesn't support persisted queries, don't try anymore
            supportsPersistedQueries = !disable(disablePayload);
            if (!supportsPersistedQueries) {
              // clear hashes from cache, we don't need them anymore
              resetHashCache();
            }

            // if its not found, we can try it again, otherwise just report the error
            if (retry(disablePayload)) {
              // need to recall the link chain
              if (subscription) subscription.unsubscribe();
              // actually send the query this time
              operation.setContext({
                http: {
                  includeQuery: true,
                  includeExtensions: supportsPersistedQueries,
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
          }
          cb();
        };
        const handler = {
          next: (response: FormattedExecutionResult) => {
            maybeRetry({ response }, () => observer.next!(response));
          },
          error: (networkError: ServerError) => {
            maybeRetry({ networkError }, () => observer.error!(networkError));
          },
          complete: observer.complete!.bind(observer),
        };

        // don't send the query the first time
        operation.setContext({
          http: {
            includeQuery: !supportsPersistedQueries,
            includeExtensions: supportsPersistedQueries,
          },
        });

        // If requested, set method to GET if there are no mutations. Remember the
        // original fetchOptions so we can restore them if we fall back to a
        // non-hashed request.
        if (
          useGETForHashedQueries &&
          supportsPersistedQueries &&
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

        if (supportsPersistedQueries) {
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
    }),
    {
      resetHashCache,
    },
    __DEV__ ?
      {
        getMemoryInternals() {
          return {
            PersistedQueryLink: {
              persistedQueryHashes: hashesByQuery?.size ?? 0,
            },
          };
        },
      }
    : {}
  );
};
