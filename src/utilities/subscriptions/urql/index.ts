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

      currentFetch!(uri, options)
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
    });
  };
}
