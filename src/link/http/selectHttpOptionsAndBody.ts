import type { ASTNode } from "graphql";
import { print } from "../../utilities/index.js";

import type { Operation } from "../core/index.js";

export interface Printer {
  (node: ASTNode, originalPrint: typeof print): string;
}

export interface UriFunction {
  (operation: Operation): string;
}

export interface Body {
  query?: string;
  operationName?: string;
  variables?: Record<string, any>;
  extensions?: Record<string, any>;
}

export interface HttpOptions {
  /**
   * The URI to use when fetching operations.
   *
   * Defaults to '/graphql'.
   */
  uri?: string | UriFunction;

  /**
   * Passes the extensions field to your graphql server.
   *
   * Defaults to false.
   */
  includeExtensions?: boolean;

  /**
   * A `fetch`-compatible API to use when making requests.
   */
  fetch?: typeof fetch;

  /**
   * An object representing values to be sent as headers on the request.
   */
  headers?: Record<string, string>;

  /**
   * If set to true, header names won't be automatically normalized to
   * lowercase. This allows for non-http-spec-compliant servers that might
   * expect capitalized header names.
   */
  preserveHeaderCase?: boolean;

  /**
   * The credentials policy you want to use for the fetch call.
   */
  credentials?: string;

  /**
   * Any overrides of the fetch options argument to pass to the fetch call.
   */
  fetchOptions?: any;

  /**
   * If set to true, use the HTTP GET method for query operations. Mutations
   * will still use the method specified in fetchOptions.method (which defaults
   * to POST).
   */
  useGETForQueries?: boolean;

  /**
   * If set to true, the default behavior of stripping unused variables
   * from the request will be disabled.
   *
   * Unused variables are likely to trigger server-side validation errors,
   * per https://spec.graphql.org/draft/#sec-All-Variables-Used, but this
   * includeUnusedVariables option can be useful if your server deviates
   * from the GraphQL specification by not strictly enforcing that rule.
   */
  includeUnusedVariables?: boolean;
  /**
   * A function to substitute for the default query print function. Can be
   * used to apply changes to the results of the print function.
   */
  print?: Printer;
}

export interface HttpQueryOptions {
  includeQuery?: boolean;
  includeExtensions?: boolean;
  preserveHeaderCase?: boolean;
}

export interface HttpConfig {
  http?: HttpQueryOptions;
  options?: any;
  headers?: Record<string, string>;
  credentials?: any;
}

const defaultHttpOptions: HttpQueryOptions = {
  includeQuery: true,
  includeExtensions: false,
  preserveHeaderCase: false,
};

const defaultHeaders = {
  // headers are case insensitive (https://stackoverflow.com/a/5259004)
  accept: "*/*",
  // The content-type header describes the type of the body of the request, and
  // so it typically only is sent with requests that actually have bodies. One
  // could imagine that Apollo Client would remove this header when constructing
  // a GET request (which has no body), but we historically have not done that.
  // This means that browsers will preflight all Apollo Client requests (even
  // GET requests). Apollo Server's CSRF prevention feature (introduced in
  // AS3.7) takes advantage of this fact and does not block requests with this
  // header. If you want to drop this header from GET requests, then you should
  // probably replace it with a `apollo-require-preflight` header, or servers
  // with CSRF prevention enabled might block your GET request. See
  // https://www.apollographql.com/docs/apollo-server/security/cors/#preventing-cross-site-request-forgery-csrf
  // for more details.
  "content-type": "application/json",
};

const defaultOptions = {
  method: "POST",
};

export const fallbackHttpConfig = {
  http: defaultHttpOptions,
  headers: defaultHeaders,
  options: defaultOptions,
};

export const defaultPrinter: Printer = (ast, printer) => printer(ast);

export function selectHttpOptionsAndBody(
  operation: Operation,
  fallbackConfig: HttpConfig,
  ...configs: Array<HttpConfig>
) {
  configs.unshift(fallbackConfig);
  return selectHttpOptionsAndBodyInternal(
    operation,
    defaultPrinter,
    ...configs
  );
}

export function selectHttpOptionsAndBodyInternal(
  operation: Operation,
  printer: Printer,
  ...configs: HttpConfig[]
) {
  let options = {} as HttpConfig & Record<string, any>;
  let http = {} as HttpQueryOptions;

  configs.forEach((config) => {
    options = {
      ...options,
      ...config.options,
      headers: {
        ...options.headers,
        ...config.headers,
      },
    };

    if (config.credentials) {
      options.credentials = config.credentials;
    }

    http = {
      ...http,
      ...config.http,
    };
  });

  if (options.headers) {
    options.headers = removeDuplicateHeaders(
      options.headers,
      http.preserveHeaderCase
    );
  }

  //The body depends on the http options
  const { operationName, extensions, variables, query } = operation;
  const body: Body = { operationName, variables };

  if (http.includeExtensions) (body as any).extensions = extensions;

  // not sending the query (i.e persisted queries)
  if (http.includeQuery) (body as any).query = printer(query, print);

  return {
    options,
    body,
  };
}

// Remove potential duplicate header names, preserving last (by insertion order).
// This is done to prevent unintentionally duplicating a header instead of
// overwriting it (See #8447 and #8449).
function removeDuplicateHeaders(
  headers: Record<string, string>,
  preserveHeaderCase: boolean | undefined
): typeof headers {
  // If we're not preserving the case, just remove duplicates w/ normalization.
  if (!preserveHeaderCase) {
    const normalizedHeaders = Object.create(null);
    Object.keys(Object(headers)).forEach((name) => {
      normalizedHeaders[name.toLowerCase()] = headers[name];
    });
    return normalizedHeaders;
  }

  // If we are preserving the case, remove duplicates w/ normalization,
  // preserving the original name.
  // This allows for non-http-spec-compliant servers that expect intentionally
  // capitalized header names (See #6741).
  const headerData = Object.create(null);
  Object.keys(Object(headers)).forEach((name) => {
    headerData[name.toLowerCase()] = {
      originalName: name,
      value: headers[name],
    };
  });

  const normalizedHeaders = Object.create(null);
  Object.keys(headerData).forEach((name) => {
    normalizedHeaders[headerData[name].originalName] = headerData[name].value;
  });
  return normalizedHeaders;
}
