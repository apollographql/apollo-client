import { Observable } from "rxjs";

import { ApolloLink } from "@apollo/client/link";
import { filterOperationVariables } from "@apollo/client/link/utils";
import {
  isMutationOperation,
  isSubscriptionOperation,
} from "@apollo/client/utilities";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { compact } from "@apollo/client/utilities/internal";
import { maybe } from "@apollo/client/utilities/internal/globals";
import { invariant } from "@apollo/client/utilities/invariant";

import { checkFetcher } from "./checkFetcher.js";
import type { HttpLink } from "./HttpLink.js";
import {
  parseAndCheckHttpResponse,
  readMultipartBody,
} from "./parseAndCheckHttpResponse.js";
import { rewriteURIForGET } from "./rewriteURIForGET.js";
import {
  defaultPrinter,
  fallbackHttpConfig,
  selectHttpOptionsAndBodyInternal,
} from "./selectHttpOptionsAndBody.js";
import { selectURI } from "./selectURI.js";
import { serializeFetchParameter } from "./serializeFetchParameter.js";

const backupFetch = maybe(() => fetch);

export class BaseHttpLink extends ApolloLink {
  constructor(linkOptions: HttpLink.Options = {}) {
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
      http: compact({ includeExtensions, preserveHeaderCase }),
      options: requestOptions.fetchOptions,
      credentials: requestOptions.credentials,
      headers: requestOptions.headers,
    };

    super((operation) => {
      let chosenURI = selectURI(operation, uri);

      const context = operation.getContext();

      const contextConfig = {
        http: context.http,
        options: context.fetchOptions,
        credentials: context.credentials,
        headers: context.headers,
      };

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
      const definitionIsMutation = isMutationOperation(operation.query);
      const isSubscription = isSubscriptionOperation(operation.query);
      if (useGETForQueries && !definitionIsMutation) {
        options.method = "GET";
      }

      if (isSubscription) {
        options.headers = options.headers || {};
        const subscriptionAcceptHeader =
          "multipart/mixed;boundary=graphql;subscriptionSpec=1.0,application/json";
        if (true) {
          const defaultAcceptHeader =
            linkOptions.headers?.accept || fallbackHttpConfig.headers.accept;
          const configuredAcceptHeader = options.headers.accept;
          if (
            configuredAcceptHeader !== defaultAcceptHeader &&
            !configuredAcceptHeader.includes("subscriptionSpec=1.0")
          ) {
            invariant.warn(
              'Accept header value\n"%s"\nis not supported with multipart subscriptions over HTTP and will be overwritten with\n"%s".\nAre you trying to combine multipart subscriptions with @defer?',
              subscriptionAcceptHeader,
              defaultAcceptHeader
            );
          }
        }

        options.headers.accept = subscriptionAcceptHeader;
      }

      return new Observable((observer) => {
        if (options.method === "GET") {
          const { newURI, parseError } = rewriteURIForGET(chosenURI, body);
          if (parseError) {
            throw parseError;
          }
          chosenURI = newURI;
        } else {
          options.body = serializeFetchParameter(body, "Payload");
        }
        // Prefer linkOptions.fetch (preferredFetch) if provided, and otherwise
        // fall back to the *current* global window.fetch function (see issue
        // #7832), or (if all else fails) the backupFetch function we saved when
        // this module was first evaluated. This last option protects against the
        // removal of window.fetch, which is unlikely but not impossible.
        const currentFetch =
          preferredFetch || maybe(() => fetch) || backupFetch;

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
            observer.error(err);
          });

        return () => {
          // XXX support canceling this request
          // https://developers.google.com/web/updates/2017/09/abortable-fetch
          if (controller) controller.abort();
        };
      });
    });
  }
}
