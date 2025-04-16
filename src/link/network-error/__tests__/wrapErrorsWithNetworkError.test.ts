import { of, throwError } from "rxjs";

import { gql } from "@apollo/client";
import { NetworkError } from "@apollo/client/errors";
import { execute, from } from "@apollo/client/link/core";
import { wrapErrorsWithNetworkError } from "@apollo/client/link/network-error";
import { ObservableStream } from "@apollo/client/testing/internal";

test("wraps errors emitted from terminating link in NetworkError", async () => {
  const query = gql`
    query {
      greeting
    }
  `;

  const terminatingLink = () => throwError(() => new Error("Oops"));
  const link = from([wrapErrorsWithNetworkError(), terminatingLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(new NetworkError(new Error("Oops")));
});

test("does not intercept successful responses", async () => {
  const query = gql`
    query {
      greeting
    }
  `;

  const terminatingLink = () => of({ data: { greeting: "hello" } });
  const link = from([wrapErrorsWithNetworkError(), terminatingLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({ data: { greeting: "hello" } });
});

test("handles emitted errors as strings", async () => {
  const query = gql`
    query {
      greeting
    }
  `;

  const terminatingLink = () => throwError(() => "Oops");
  const link = from([wrapErrorsWithNetworkError(), terminatingLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitError(new NetworkError("Oops"));
});

test("handles emitted errors as an unconventional type", async () => {
  const query = gql`
    query {
      greeting
    }
  `;

  for (const type of [Symbol(), { message: "This is an error" }, ["Error"]]) {
    const terminatingLink = () => throwError(() => type);
    const link = from([wrapErrorsWithNetworkError(), terminatingLink]);
    const stream = new ObservableStream(execute(link, { query }));

    await expect(stream).toEmitError(new NetworkError(type));
  }
});
