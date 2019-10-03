import Observable from 'zen-observable';
import { DefinitionNode } from 'graphql';

import {
  serializeFetchParameter,
  selectURI,
  parseAndCheckHttpResponse,
  checkFetcher,
  selectHttpOptionsAndBody,
  createSignalIfSupported,
  fallbackHttpConfig,
  Body,
  HttpOptions,
  UriFunction as _UriFunction,
} from './common';
import { ApolloLink, RequestHandler } from '../core';
import { fromError } from '../utils/fromError';

export namespace HttpLink {
  //TODO Would much rather be able to export directly
  export interface UriFunction extends _UriFunction {}
  export interface Options extends HttpOptions {
    /**
     * If set to true, use the HTTP GET method for query operations. Mutations
     * will still use the method specified in fetchOptions.method (which defaults
     * to POST).
     */
    useGETForQueries?: boolean;
  }
}

// For backwards compatibility.
export import FetchOptions = HttpLink.Options;
export import UriFunction = HttpLink.UriFunction;

export const createHttpLink = (linkOptions: HttpLink.Options = {}) => {
  let {
    uri = '/graphql',
    // use default global fetch if nothing passed in
    fetch: fetcher,
    includeExtensions,
    useGETForQueries,
    ...requestOptions
  } = linkOptions;

  // dev warnings to ensure fetch is present
  checkFetcher(fetcher);

  //fetcher is set here rather than the destructuring to ensure fetch is
  //declared before referencing it. Reference in the destructuring would cause
  //a ReferenceError
  if (!fetcher) {
    fetcher = fetch;
  }

  const linkConfig = {
    http: { includeExtensions },
    options: requestOptions.fetchOptions,
    credentials: requestOptions.credentials,
    headers: requestOptions.headers,
  };

  return new ApolloLink(operation => {
    let chosenURI = selectURI(operation, uri);

    const context = operation.getContext();

    // `apollographql-client-*` headers are automatically set if a
    // `clientAwareness` object is found in the context. These headers are
    // set first, followed by the rest of the headers pulled from
    // `context.headers`. If desired, `apollographql-client-*` headers set by
    // the `clientAwareness` object can be overridden by
    // `apollographql-client-*` headers set in `context.headers`.
    const clientAwarenessHeaders: {
      'apollographql-client-name'?: string;
      'apollographql-client-version'?: string;
    } = {};

    if (context.clientAwareness) {
      const { name, version } = context.clientAwareness;
      if (name) {
        clientAwarenessHeaders['apollographql-client-name'] = name;
      }
      if (version) {
        clientAwarenessHeaders['apollographql-client-version'] = version;
      }
    }

    const contextHeaders = { ...clientAwarenessHeaders, ...context.headers };

    const contextConfig = {
      http: context.http,
      options: context.fetchOptions,
      credentials: context.credentials,
      headers: contextHeaders,
    };

    //uses fallback, link, and then context to build options
    const { options, body } = selectHttpOptionsAndBody(
      operation,
      fallbackHttpConfig,
      linkConfig,
      contextConfig,
    );

    let controller: any;
    if (!(options as any).signal) {
      const { controller: _controller, signal } = createSignalIfSupported();
      controller = _controller;
      if (controller) (options as any).signal = signal;
    }

    // If requested, set method to GET if there are no mutations.
    const definitionIsMutation = (d: DefinitionNode) => {
      return d.kind === 'OperationDefinition' && d.operation === 'mutation';
    };
    if (
      useGETForQueries &&
      !operation.query.definitions.some(definitionIsMutation)
    ) {
      options.method = 'GET';
    }

    if (options.method === 'GET') {
      const { newURI, parseError } = rewriteURIForGET(chosenURI, body);
      if (parseError) {
        return fromError(parseError);
      }
      chosenURI = newURI;
    } else {
      try {
        (options as any).body = serializeFetchParameter(body, 'Payload');
      } catch (parseError) {
        return fromError(parseError);
      }
    }

    return new Observable(observer => {
      fetcher(chosenURI, options)
        .then(response => {
          operation.setContext({ response });
          return response;
        })
        .then(parseAndCheckHttpResponse(operation))
        .then(result => {
          // we have data and can send it to back up the link chain
          observer.next(result);
          observer.complete();
          return result;
        })
        .catch(err => {
          // fetch was cancelled so it's already been cleaned up in the unsubscribe
          if (err.name === 'AbortError') return;
          // if it is a network error, BUT there is graphql result info
          // fire the next observer before calling error
          // this gives apollo-client (and react-apollo) the `graphqlErrors` and `networErrors`
          // to pass to UI
          // this should only happen if we *also* have data as part of the response key per
          // the spec
          if (err.result && err.result.errors && err.result.data) {
            // if we don't call next, the UI can only show networkError because AC didn't
            // get any graphqlErrors
            // this is graphql execution result info (i.e errors and possibly data)
            // this is because there is no formal spec how errors should translate to
            // http status codes. So an auth error (401) could have both data
            // from a public field, errors from a private field, and a status of 401
            // {
            //  user { // this will have errors
            //    firstName
            //  }
            //  products { // this is public so will have data
            //    cost
            //  }
            // }
            //
            // the result of above *could* look like this:
            // {
            //   data: { products: [{ cost: "$10" }] },
            //   errors: [{
            //      message: 'your session has timed out',
            //      path: []
            //   }]
            // }
            // status code of above would be a 401
            // in the UI you want to show data where you can, errors as data where you can
            // and use correct http status codes
            observer.next(err.result);
          }
          observer.error(err);
        });

      return () => {
        // XXX support canceling this request
        // https://developers.google.com/web/updates/2017/09/abortable-fetch
        if (controller) controller.abort();
      };
    });
  });
};

// For GET operations, returns the given URI rewritten with parameters, or a
// parse error.
function rewriteURIForGET(chosenURI: string, body: Body) {
  // Implement the standard HTTP GET serialization, plus 'extensions'. Note
  // the extra level of JSON serialization!
  const queryParams: string[] = [];
  const addQueryParam = (key: string, value: string) => {
    queryParams.push(`${key}=${encodeURIComponent(value)}`);
  };

  if ('query' in body) {
    addQueryParam('query', body.query);
  }
  if (body.operationName) {
    addQueryParam('operationName', body.operationName);
  }
  if (body.variables) {
    let serializedVariables;
    try {
      serializedVariables = serializeFetchParameter(
        body.variables,
        'Variables map',
      );
    } catch (parseError) {
      return { parseError };
    }
    addQueryParam('variables', serializedVariables);
  }
  if (body.extensions) {
    let serializedExtensions;
    try {
      serializedExtensions = serializeFetchParameter(
        body.extensions,
        'Extensions map',
      );
    } catch (parseError) {
      return { parseError };
    }
    addQueryParam('extensions', serializedExtensions);
  }

  // Reconstruct the URI with added query params.
  // XXX This assumes that the URI is well-formed and that it doesn't
  //     already contain any of these query params. We could instead use the
  //     URL API and take a polyfill (whatwg-url@6) for older browsers that
  //     don't support URLSearchParams. Note that some browsers (and
  //     versions of whatwg-url) support URL but not URLSearchParams!
  let fragment = '',
    preFragment = chosenURI;
  const fragmentStart = chosenURI.indexOf('#');
  if (fragmentStart !== -1) {
    fragment = chosenURI.substr(fragmentStart);
    preFragment = chosenURI.substr(0, fragmentStart);
  }
  const queryParamsPrefix = preFragment.indexOf('?') === -1 ? '?' : '&';
  const newURI =
    preFragment + queryParamsPrefix + queryParams.join('&') + fragment;
  return { newURI };
}

export class HttpLink extends ApolloLink {
  public requester: RequestHandler;
  constructor(opts?: HttpLink.Options) {
    super(createHttpLink(opts).request);
  }
}
