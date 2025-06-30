import { Observable } from "../../index.js";
import {
  handleError,
  readMultipartBody,
} from "../../../link/http/parseAndCheckHttpResponse.js";
import { maybe } from "../../index.js";
import { serializeFetchParameter } from "../../../core/index.js";
import type { Body } from "../../../link/http/selectHttpOptionsAndBody.js";
import { generateOptionsForMultipartSubscription } from "../shared.js";
import type { CreateMultipartSubscriptionOptions } from "../shared.js";

const backupFetch = maybe(() => fetch);

/**
 * @deprecated `createFetchMultipartSubscription` will be removed in Apollo
 * Client 4.0. `urql` has native support for Apollo multipart subscriptions,
 * so you don't need to use this function anymore.
 */
export function createFetchMultipartSubscription(
  uri: string,
  { fetch: preferredFetch, headers }: CreateMultipartSubscriptionOptions = {}
) {
  return function multipartSubscriptionForwarder({
    query,
    variables,
  }: {
    query?: string;
    variables: undefined | Record<string, any>;
  }) {
    const body: Body = { variables, query };
    const options = generateOptionsForMultipartSubscription(headers || {});

    return new Observable((observer) => {
      try {
        options.body = serializeFetchParameter(body, "Payload");
      } catch (parseError) {
        observer.error(parseError);
      }

      const currentFetch = preferredFetch || maybe(() => fetch) || backupFetch;
      const observerNext = observer.next.bind(observer);

      const abortController = new AbortController();

      currentFetch!(uri, { ...options, signal: abortController.signal })
        .then((response) => {
          const ctype = response.headers?.get("content-type");

          if (ctype !== null && /^multipart\/mixed/i.test(ctype)) {
            return readMultipartBody(response, observerNext);
          }

          observer.error(new Error("Expected multipart response"));
        })
        .then(() => {
          observer.complete();
        })
        .catch((err: any) => {
          handleError(err, observer);
        });

      return () => {
        abortController.abort();
      };
    });
  };
}
