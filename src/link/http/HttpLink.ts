import '../../utilities/globals';
import { ApolloLink, Operation, RequestHandler } from '../core';
import { visit, DefinitionNode, VariableDefinitionNode } from 'graphql';
import { Observable, Observer } from '../../utilities';
import { serializeFetchParameter } from './serializeFetchParameter';
import { checkFetcher } from './checkFetcher';
import { selectURI } from './selectURI';
import {
  selectHttpOptionsAndBody,
  defaultPrinter,
  fallbackHttpConfig,
  HttpOptions
} from './selectHttpOptionsAndBody';
import { createSignalIfSupported } from './createSignalIfSupported';
import { rewriteURIForGET } from './rewriteURIForGET';
import { fromError, throwServerError } from '../utils';
import { maybe } from '../../utilities';

const backupFetch = maybe(() => fetch);
const { hasOwnProperty } = Object.prototype;

function parseMultipartBoundary(contentType: string) {
  const boundary = contentType.split('boundary=')[1];
  if (boundary) {
    return boundary.replace(/^('|")/, '').replace(/('|")$/, '');
  }

  return '-';
}

function parseHeaders(headerText: string): Headers {
  const headersInit: Record<string, string> = {};
  headerText.split('\n').forEach(line => {
    const i = line.indexOf(':');
    if (i > -1) {
      const name = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim();
      headersInit[name] = value;
    }
  });

  return new Headers(headersInit);
}

export type ServerParseError = Error & {
  response: Response;
  statusCode: number;
  bodyText: string;
};

// TODO: better return type
function parseJSONBody(response: Response, bodyText: string): any {
  try {
    return JSON.parse(bodyText);
  } catch (err) {
    const parseError = err as ServerParseError;
    parseError.name = 'ServerParseError';
    parseError.response = response;
    parseError.statusCode = response.status;
    parseError.bodyText = bodyText;
    throw parseError;
  }
}

function handleError(err: any, observer: Observer<any>) {
  if (err.name === 'AbortError') return;
  // if it is a network error, BUT there is graphql result info fire
  // the next observer before calling error this gives apollo-client
  // (and react-apollo) the `graphqlErrors` and `networErrors` to
  // pass to UI this should only happen if we *also* have data as
  // part of the response key per the spec
  if (err.result && err.result.errors && err.result.data) {
    // if we don't call next, the UI can only show networkError
    // because AC didn't get any graphqlErrors this is graphql
    // execution result info (i.e errors and possibly data) this is
    // because there is no formal spec how errors should translate to
    // http status codes. So an auth error (401) could have both data
    // from a public field, errors from a private field, and a status
    // of 401
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
    observer.next?.(err.result);
  }

  observer.error?.(err);
}

// TODO: naming
function readJSONBody(
  response: Response,
  operation: Operation,
  observer: Observer<any>,
) {
  response.text()
    .then(bodyText => parseJSONBody(response, bodyText))
    .then((result: any) => {
      if (response.status >= 300) {
        // Network error
        throwServerError(
          response,
          result,
          `Response not successful: Received status code ${response.status}`,
        );
      }

      if (
        !Array.isArray(result) &&
        !hasOwnProperty.call(result, 'data') &&
        !hasOwnProperty.call(result, 'errors')
      ) {
        // Data error
        throwServerError(
          response,
          result,
          `Server response was missing for query '${operation.operationName}'.`,
        );
      }

      observer.next?.(result);
      observer.complete?.();
    })
    .catch(err => handleError(err, observer));
}

function readMultipartWHATWGStream(
  response: Response,
  body: ReadableStream<Uint8Array>,
  boundary: string,
  observer: Observer<any>,
) {
  // TODO: does this have to polyfilled? If there is a body, then there is likely a decoder.
  const decoder = new TextDecoder('utf8');
  let buffer = '';
  const messageBoundary = '--' + boundary;
  // TODO: End message boundary
  const reader = body.getReader();
  (function read() {
    reader.read()
      .then(iteration => {
        if (iteration.done) {
          observer.complete?.();
          return;
        }

        const chunk = decoder.decode(iteration.value);
        buffer += chunk;

        let bi = buffer.indexOf(messageBoundary);
        while (bi > -1) {
          let message: string;
          [message, buffer] = [
            buffer.slice(0, bi),
            buffer.slice(bi + messageBoundary.length),
          ];

          if (message.trim()) {
            const i = message.indexOf("\r\n\r\n");
            const headers = parseHeaders(message.slice(0, i));
            const contentType = headers.get('content-type');
            if (contentType !== null && contentType.indexOf('application/json') === -1) {
              throw new Error('Unsupported patch content type');
            }

            const body = message.slice(i);
            const result = parseJSONBody(response, body);
            observer.next?.(result);
          }

          bi = buffer.indexOf(messageBoundary);
        }

        read();
      })
      .catch(err => handleError(err, observer));
  })();
}

function readMultipartNodeStream(
  ..._args: any[]
) {
  throw new Error("TODO");
}

function readMultipartBuffer(
  response: Response,
  buffer: Uint8Array | Buffer,
  boundary: string,
  observer: Observer<any>,
) {
  let text: string;
  if (buffer.toString.length > 0) {
    text = buffer.toString('utf8');
  } else {
    const decoder = new TextDecoder('utf8');
    text = decoder.decode(buffer);
  }

  readMultipartString(response, text, boundary, observer);
}

function readMultipartString(
  response: Response,
  text: string,
  boundary: string,
  observer: Observer<any>,
) {
  let buffer = text;
  const messageBoundary = '--' + boundary;
  let bi = buffer.indexOf(messageBoundary);
  while (bi > -1) {
    let message: string;
    [message, buffer] = [
      buffer.slice(0, bi),
      buffer.slice(bi + messageBoundary.length),
    ];

    if (message.trim()) {
      const i = message.indexOf("\r\n\r\n");
      const headers = parseHeaders(message.slice(0, i));
      const contentType = headers.get('content-type');
      if (contentType !== null && contentType.indexOf('application/json') === -1) {
        throw new Error('Unsupported patch content type');
      }

      const body = message.slice(i);
      const result = parseJSONBody(response, body);
      observer.next?.(result);
    }

    bi = buffer.indexOf(messageBoundary);
  }
}

export class HttpLink extends ApolloLink {
  public requester: RequestHandler;

  public options: HttpOptions;
  constructor(options: HttpOptions = {}) {
   let {
      uri = '/graphql',
      // use default global fetch if nothing passed in
      fetch: preferredFetch,
      print = defaultPrinter,
      includeExtensions,
      useGETForQueries,
      includeUnusedVariables = false,
      ...requestOptions
    } = options;

    if (__DEV__) {
      // Make sure at least one of preferredFetch, window.fetch, or backupFetch is
      // defined, so requests won't fail at runtime.
      checkFetcher(preferredFetch || backupFetch);
    }

    let controller: AbortController | false;
    if (!(options as any).signal) {
      const { controller: _controller, signal } = createSignalIfSupported();
      controller = _controller as any;
      if (controller) (options as any).signal = signal;
    }

    const linkConfig = {
      http: { includeExtensions },
      options: requestOptions.fetchOptions,
      credentials: requestOptions.credentials,
      headers: requestOptions.headers,
    };

    super(operation => {
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
        print,
        fallbackHttpConfig,
        linkConfig,
        contextConfig,
      );

      if (body.variables && !includeUnusedVariables) {
        const unusedNames = new Set(Object.keys(body.variables));
        visit(operation.query, {
          Variable(node, _key, parent) {
            // A variable type definition at the top level of a query is not
            // enough to silence server-side errors about the variable being
            // unused, so variable definitions do not count as usage.
            // https://spec.graphql.org/draft/#sec-All-Variables-Used
            if (parent && (parent as VariableDefinitionNode).kind !== 'VariableDefinition') {
              unusedNames.delete(node.name.value);
            }
          },
        });
        if (unusedNames.size) {
          // Make a shallow copy of body.variables (with keys in the same
          // order) and then delete unused variables from the copy.
          body.variables = { ...body.variables };
          unusedNames.forEach(name => {
            delete body.variables![name];
          });
        }
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
        // Prefer linkOptions.fetch (preferredFetch) if provided, and otherwise
        // fall back to the *current* global window.fetch function (see issue
        // #7832), or (if all else fails) the backupFetch function we saved when
        // this module was first evaluated. This last option protects against the
        // removal of window.fetch, which is unlikely but not impossible.
        const currentFetch = preferredFetch || maybe(() => fetch) || backupFetch;

        currentFetch!(chosenURI, options)
          .then(response => {
            operation.setContext({ response });
            const contentType = response.headers?.get('content-type');
            if (contentType !== null && /^multipart\/mixed/.test(contentType)) {
              const boundary = parseMultipartBoundary(contentType!);
              if (response.body === null) {
                throw new Error("Missing body");
              } else if (typeof response.body.tee === "function") {
                // WHATWG Stream
                readMultipartWHATWGStream(response, response.body, boundary, observer);
              } else if (typeof (response.body as any).on === "function") {
                readMultipartNodeStream(response, response.body, boundary, observer);
              } else if (typeof response.body === 'string') {
                readMultipartString(response, response.body, boundary, observer);
              } else if (typeof (response.body as any).byteLength === 'number') {
                readMultipartBuffer(response, (response.body as any), boundary, observer);
              } else {
                throw new Error(
                  'Streaming bodies not supported by provided fetch implementation',
                );
              }
            } else {
              readJSONBody(response, operation, observer);
            }
          })
          .catch(err => handleError(err, observer));
        return () => {
          if (controller) controller.abort();
        };
      });
    });

    this.options = options;
  }
}
