import { Observable } from "relay-runtime";
import type { RequestParameters, GraphQLResponse } from "relay-runtime";
import {
  handleError,
  readMultipartBody,
} from "../../../link/http/parseAndCheckHttpResponse.js";
import { maybe } from "../../index.js";
import { serializeFetchParameter } from "../../../core/index.js";

import type { OperationVariables } from "../../../core/index.js";
import type { Body } from "../../../link/http/selectHttpOptionsAndBody.js";
import { generateOptionsForMultipartSubscription } from "../shared.js";
import type { CreateMultipartSubscriptionOptions } from "../shared.js";

const backupFetch = maybe(() => fetch);

export function createFetchMultipartSubscription(
  uri: string,
  { fetch: preferredFetch, headers }: CreateMultipartSubscriptionOptions = {}
) {
  return function fetchMultipartSubscription(
    operation: RequestParameters,
    variables: OperationVariables
  ): Observable<GraphQLResponse> {
    const body: Body = {
      operationName: operation.name,
      variables,
      query: operation.text || "",
    };
    const options = generateOptionsForMultipartSubscription(headers || {});

    return Observable.create((sink) => {
      try {
        options.body = serializeFetchParameter(body, "Payload");
      } catch (parseError) {
        sink.error(parseError as Error);
      }

      const currentFetch = preferredFetch || maybe(() => fetch) || backupFetch;
      const observerNext = sink.next.bind(sink);

      currentFetch!(uri, options)
        .then((response) => {
          const ctype = response.headers?.get("content-type");

          if (ctype !== null && /^multipart\/mixed/i.test(ctype)) {
            return readMultipartBody(response, observerNext);
          }

          sink.error(new Error("Expected multipart response"));
        })
        .then(() => {
          sink.complete();
        })
        .catch((err: any) => {
          handleError(err, sink);
        });
    });
  };
}
