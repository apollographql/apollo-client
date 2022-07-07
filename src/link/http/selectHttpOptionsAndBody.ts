import { ASTNode, print } from 'graphql';

import { Operation } from '../core';

export interface Printer {
  (node: ASTNode, originalPrint: typeof print): string
};

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
  fetch?: WindowOrWorkerGlobalScope['fetch'];

  /**
   * An object representing values to be sent as headers on the request.
   */
  headers?: any;

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
}

export interface HttpConfig {
  http?: HttpQueryOptions;
  options?: any;
  headers?: any;
  credentials?: any;
}

const defaultHttpOptions: HttpQueryOptions = {
  includeQuery: true,
  includeExtensions: false,
};

const defaultHeaders = {
  // headers are case insensitive (https://stackoverflow.com/a/5259004)
  accept: '*/*',
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
  'content-type': 'application/json',
};

const defaultOptions = {
  method: 'POST',
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
    ...configs,
  );
}

export function selectHttpOptionsAndBodyInternal(
  operation: Operation,
  printer: Printer,
  ...configs: HttpConfig[]
) {
  let options = {} as HttpConfig & Record<string, any>;
  let http = {} as HttpQueryOptions;

  configs.forEach(config => {
    options = {
      ...options,
      ...config.options,
      headers: normalizeHeaders({
        ...options.headers, 
        ...config.headers
      }),
    };

    if (config.credentials) {
      options.credentials = config.credentials;
    }

    http = {
      ...http,
      ...config.http,
    };
  });

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
};

function normalizeHeaders(
  headers: Record<string, string> | undefined
): typeof headers {
  if (!headers) {
    return headers
  }

  // Remove potential duplicates, preserving
  // last (by insertion order). Save the original 
  // capitalization of each header for later.
  // This is done to prevent unintentionally duplicating 
  // a header instead of overwriting it, see 
  // apollo-client/#8447 and #8449).
  debugger;
  const headerNames = Object.create(null);
  Object.keys(Object(headers)).forEach(name => {
    headerNames[name.toLowerCase()] = {originalName: name, value:headers[name]}
  });

  // Go through our headers and, now that we're sure there's no
  // duplicate names, set the names back to their original 
  // capitalization.
  // This is done to allow for non-http-spec-compliant servers 
  // that expect intentionally capitalized header names 
  // (See #6741).
  const normalizedHeaders = Object.create(null);
  Object.keys(headerNames).forEach(name => {
    const originalName = headerNames[name].originalName;
    normalizedHeaders[originalName] = headerNames[name].value;
  });

  return normalizedHeaders;
}
