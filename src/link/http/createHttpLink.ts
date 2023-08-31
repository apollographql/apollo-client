import { invariant } from "../../utilities/globals/index.js";

import type { DefinitionNode } from "graphql";

import { ApolloLink } from "../core/index.js";
import { Observable, hasDirectives } from "../../utilities/index.js";
import { serializeFetchParameter } from "./serializeFetchParameter.js";
import { selectURI } from "./selectURI.js";
import {
  handleError,
  readMultipartBody,
  parseAndCheckHttpResponse,
} from "./parseAndCheckHttpResponse.js";
import { checkFetcher } from "./checkFetcher.js";
import type { HttpOptions } from "./selectHttpOptionsAndBody.js";
import {
  selectHttpOptionsAndBodyInternal,
  defaultPrinter,
  fallbackHttpConfig,
} from "./selectHttpOptionsAndBody.js";
import { rewriteURIForGET } from "./rewriteURIForGET.js";
import { fromError, filterOperationVariables } from "../utils/index.js";
import {
  maybe,
  getMainDefinition,
  removeClientSetsFromDocument,
} from "../../utilities/index.js";

const backupFetch = maybe(() => fetch);

export const createHttpLink = (linkOptions: HttpOptions = {}) => {
  let {
    uri = "/graphql",
    // use default global fetch if nothing passed in
    fetch: preferredFetch,
    print = defaultPrinter,
    includeExtensions,
    preserveHeaderCase,
    useGETForQueries,
    includeUnusedVariables = false,
    ...requestOptions
  } = linkOptions;

  if (__DEV__) {
    // Make sure at least one of preferredFetch, window.fetch, or backupFetch is
    // defined, so requests won't fail at runtime.
    checkFetcher(preferredFetch || backupFetch);
  }

  const linkConfig = {
    http: { includeExtensions, preserveHeaderCase },
    options: requestOptions.fetchOptions,
    credentials: requestOptions.credentials,
    headers: requestOptions.headers,
  };

  return new ApolloLink((operation) => {
    let chosenURI = selectURI(operation, uri);

    const context = operation.getContext();

    // `apollographql-client-*` headers are automatically set if a
    // `clientAwareness` object is found in the context. These headers are
    // set first, followed by the rest of the headers pulled from
    // `context.headers`. If desired, `apollographql-client-*` headers set by
    // the `clientAwareness` object can be overridden by
    // `apollographql-client-*` headers set in `context.headers`.
    const clientAwarenessHeaders: {
      "apollographql-client-name"?: string;
      "apollographql-client-version"?: string;
    } = {};

    if (context.clientAwareness) {
      const { name, version } = context.clientAwareness;
      if (name) {
        clientAwarenessHeaders["apollographql-client-name"] = name;
      }
      if (version) {
        clientAwarenessHeaders["apollographql-client-version"] = version;
      }
    }

    const contextHeaders = { ...clientAwarenessHeaders, ...context.headers };

    const contextConfig = {
      http: context.http,
      options: context.fetchOptions,
      credentials: context.credentials,
      headers: contextHeaders,
    };

    if (hasDirectives(["client"], operation.query)) {
      const transformedQuery = removeClientSetsFromDocument(operation.query);

      if (!transformedQuery) {
        return fromError(
          new Error(
            "HttpLink: Trying to send a client-only query to the server. To send to the server, ensure a non-client field is added to the query or set the `transformOptions.removeClientFields` option to `true`."
          )
        );
      }

      operation.query = transformedQuery;
    }

    //uses fallback, link, and then context to build options
    const { options, body } = selectHttpOptionsAndBodyInternal(
      operation,
      print,
      fallbackHttpConfig,
      linkConfig,
      contextConfig
    );

    if (body.variables && !includeUnusedVariables) {
      body.variables = filterOperationVariables(
        body.variables,
        operation.query
      );
    }

    let controller: AbortController | undefined;
    if (!options.signal && typeof AbortController !== "undefined") {
      controller = new AbortController();
      options.signal = controller.signal;
    }

    // If requested, set method to GET if there are no mutations.
    const definitionIsMutation = (d: DefinitionNode) => {
      return d.kind === "OperationDefinition" && d.operation === "mutation";
    };
    const definitionIsSubscription = (d: DefinitionNode) => {
      return d.kind === "OperationDefinition" && d.operation === "subscription";
    };
    const isSubscription = definitionIsSubscription(
      getMainDefinition(operation.query)
    );
    // does not match custom directives beginning with @defer
    const hasDefer = hasDirectives(["defer"], operation.query);
    if (
      useGETForQueries &&
      !operation.query.definitions.some(definitionIsMutation)
    ) {
      options.method = "GET";
    }

    if (hasDefer || isSubscription) {
      options.headers = options.headers || {};
      let acceptHeader = "multipart/mixed;";
      // Omit defer-specific headers if the user attempts to defer a selection
      // set on a subscription and log a warning.
      if (isSubscription && hasDefer) {
        invariant.warn("Multipart-subscriptions do not support @defer");
      }

      if (isSubscription) {
        acceptHeader +=
          "boundary=graphql;subscriptionSpec=1.0,application/json";
      } else if (hasDefer) {
        acceptHeader += "deferSpec=20220824,application/json";
      }
      options.headers.accept = acceptHeader;
    }

    if (options.method === "GET") {
      const { newURI, parseError } = rewriteURIForGET(chosenURI, body);
      if (parseError) {
        return fromError(parseError);
      }
      chosenURI = newURI;
    } else {
      try {
        (options as any).body = serializeFetchParameter(body, "Payload");
      } catch (parseError) {
        return fromError(parseError);
      }
    }

    return new Observable((observer) => {
      // Prefer linkOptions.fetch (preferredFetch) if provided, and otherwise
      // fall back to the *current* global window.fetch function (see issue
      // #7832), or (if all else fails) the backupFetch function we saved when
      // this module was first evaluated. This last option protects against the
      // removal of window.fetch, which is unlikely but not impossible.
      const currentFetch = preferredFetch || maybe(() => fetch) || backupFetch;

      const observerNext = observer.next.bind(observer);
      currentFetch!(chosenURI, options)
        .then((response) => {
          operation.setContext({ response });
          const ctype = response.headers?.get("content-type");

          if (ctype !== null && /^multipart\/mixed/i.test(ctype)) {
            return readMultipartBody(response, observerNext);
          } else {
            return parseAndCheckHttpResponse(operation)(response).then(
              observerNext
            );
          }
        })
        .then(() => {
          controller = undefined;
          observer.complete();
        })
        .catch((err) => {
          controller = undefined;
          handleError(err, observer);
        });

      return () => {
        // XXX support canceling this request
        // https://developers.google.com/web/updates/2017/09/abortable-fetch
        if (controller) controller.abort();
      };
    });
  });
};
