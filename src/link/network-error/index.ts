import { catchError } from "rxjs";

import { NetworkError } from "@apollo/client/errors";
import { ApolloLink } from "@apollo/client/link/core";

export function wrapErrorsWithNetworkError() {
  return new ApolloLink((operation, forward) => {
    return forward(operation).pipe(
      catchError((error) => {
        throw new NetworkError(error);
      })
    );
  });
}
