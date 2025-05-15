import type { GraphQLResponse, RequestParameters } from "relay-runtime";
import { Observable } from "relay-runtime";

import type { OperationVariables } from "@apollo/client";
import { serializeFetchParameter } from "@apollo/client";
import type { HttpLink } from "@apollo/client/link/http";
import { maybe } from "@apollo/client/utilities/internal/globals";

import {
  handleError,
  readMultipartBody,
} from "../../../link/http/parseAndCheckHttpResponse.js";
import { fallbackHttpConfig } from "../../../link/http/selectHttpOptionsAndBody.js";

const backupFetch = maybe(() => fetch);

type CreateMultipartSubscriptionOptions = {
  fetch?: WindowOrWorkerGlobalScope["fetch"];
  headers?: Record<string, string>;
};

export function createFetchMultipartSubscription(
  uri: string,
  { fetch: preferredFetch, headers }: CreateMultipartSubscriptionOptions = {}
) {
  return function fetchMultipartSubscription(
    operation: RequestParameters,
    variables: OperationVariables
  ): Observable<GraphQLResponse> {
    const body: HttpLink.Body = {
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

function generateOptionsForMultipartSubscription(
  headers: Record<string, string>
) {
  const options: { headers: Record<string, any>; body?: string } = {
    ...fallbackHttpConfig.options,
    headers: {
      ...(headers || {}),
      ...fallbackHttpConfig.headers,
      accept:
        "multipart/mixed;boundary=graphql;subscriptionSpec=1.0,application/json",
    },
  };
  return options;
}
