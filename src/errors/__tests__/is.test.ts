import { expectTypeOf } from "expect-type";

import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  ServerError,
  ServerParseError,
  UnconventionalError,
} from "@apollo/client/errors";

const graphQLErrors = new CombinedGraphQLErrors({ errors: [] });
const protocolErrors = new CombinedProtocolErrors([]);
const serverError = new ServerError("Oops", {
  response: new Response("", { status: 400 }),
  result: "",
});
const serverParseError = new ServerParseError(new Error("Oops"), {
  response: new Response("", { status: 400 }),
  bodyText: "",
});

const unconventionalError = new UnconventionalError(Symbol());

test("CombinedGraphQLErrors.is", () => {
  expect(CombinedGraphQLErrors.is(graphQLErrors)).toBe(true);

  expect(CombinedGraphQLErrors.is(protocolErrors)).toBe(false);
  expect(CombinedGraphQLErrors.is(serverError)).toBe(false);
  expect(CombinedGraphQLErrors.is(serverParseError)).toBe(false);
  expect(CombinedGraphQLErrors.is(unconventionalError)).toBe(false);
  expect(CombinedGraphQLErrors.is(new Error("Oops"))).toBe(false);

  expect(CombinedGraphQLErrors.is(undefined)).toBe(false);
  expect(CombinedGraphQLErrors.is(null)).toBe(false);
  expect(CombinedGraphQLErrors.is({})).toBe(false);
  expect(CombinedGraphQLErrors.is(Symbol())).toBe(false);
  expect(CombinedGraphQLErrors.is(10)).toBe(false);
  expect(CombinedGraphQLErrors.is("true")).toBe(false);
  expect(CombinedGraphQLErrors.is(true)).toBe(false);
});

test("CombinedProtocolErrors.is", () => {
  expect(CombinedProtocolErrors.is(protocolErrors)).toBe(true);

  expect(CombinedProtocolErrors.is(graphQLErrors)).toBe(false);
  expect(CombinedProtocolErrors.is(serverError)).toBe(false);
  expect(CombinedProtocolErrors.is(serverParseError)).toBe(false);
  expect(CombinedProtocolErrors.is(unconventionalError)).toBe(false);
  expect(CombinedProtocolErrors.is(new Error("Oops"))).toBe(false);

  expect(CombinedProtocolErrors.is(undefined)).toBe(false);
  expect(CombinedProtocolErrors.is(null)).toBe(false);
  expect(CombinedProtocolErrors.is({})).toBe(false);
  expect(CombinedProtocolErrors.is(Symbol())).toBe(false);
  expect(CombinedProtocolErrors.is(10)).toBe(false);
  expect(CombinedProtocolErrors.is("true")).toBe(false);
  expect(CombinedProtocolErrors.is(true)).toBe(false);
});

test("ServerError.is", () => {
  expect(ServerError.is(serverError)).toBe(true);

  expect(ServerError.is(graphQLErrors)).toBe(false);
  expect(ServerError.is(protocolErrors)).toBe(false);
  expect(ServerError.is(serverParseError)).toBe(false);
  expect(ServerError.is(unconventionalError)).toBe(false);
  expect(ServerError.is(new Error("Oops"))).toBe(false);

  expect(ServerError.is(undefined)).toBe(false);
  expect(ServerError.is(null)).toBe(false);
  expect(ServerError.is({})).toBe(false);
  expect(ServerError.is(Symbol())).toBe(false);
  expect(ServerError.is(10)).toBe(false);
  expect(ServerError.is("true")).toBe(false);
  expect(ServerError.is(true)).toBe(false);
});

test("ServerParseError.is", () => {
  expect(ServerParseError.is(serverParseError)).toBe(true);

  expect(ServerParseError.is(graphQLErrors)).toBe(false);
  expect(ServerParseError.is(protocolErrors)).toBe(false);
  expect(ServerParseError.is(serverError)).toBe(false);
  expect(ServerParseError.is(unconventionalError)).toBe(false);
  expect(ServerParseError.is(new Error("Oops"))).toBe(false);

  expect(ServerParseError.is(undefined)).toBe(false);
  expect(ServerParseError.is(null)).toBe(false);
  expect(ServerParseError.is({})).toBe(false);
  expect(ServerParseError.is(Symbol())).toBe(false);
  expect(ServerParseError.is(10)).toBe(false);
  expect(ServerParseError.is("true")).toBe(false);
  expect(ServerParseError.is(true)).toBe(false);
});

test("UnconventionalError.is", () => {
  expect(UnconventionalError.is(unconventionalError)).toBe(true);

  expect(UnconventionalError.is(graphQLErrors)).toBe(false);
  expect(UnconventionalError.is(protocolErrors)).toBe(false);
  expect(UnconventionalError.is(serverError)).toBe(false);
  expect(UnconventionalError.is(serverParseError)).toBe(false);
  expect(UnconventionalError.is(new Error("Oops"))).toBe(false);

  expect(UnconventionalError.is(undefined)).toBe(false);
  expect(UnconventionalError.is(null)).toBe(false);
  expect(UnconventionalError.is({})).toBe(false);
  expect(UnconventionalError.is(Symbol())).toBe(false);
  expect(UnconventionalError.is(10)).toBe(false);
  expect(UnconventionalError.is("true")).toBe(false);
  expect(UnconventionalError.is(true)).toBe(false);
});

declare const error: unknown;

describe.skip("type tests", () => {
  test("type narrows CombinedGraphQLErrors", () => {
    if (CombinedGraphQLErrors.is(error)) {
      expectTypeOf(error).toEqualTypeOf<CombinedGraphQLErrors>();
    }
  });

  test("type narrows CombinedProtocolErrors", () => {
    if (CombinedProtocolErrors.is(error)) {
      expectTypeOf(error).toEqualTypeOf<CombinedProtocolErrors>();
    }
  });

  test("type narrows ServerError", () => {
    if (ServerError.is(error)) {
      expectTypeOf(error).toEqualTypeOf<ServerError>();
    }
  });

  test("type narrows ServerParseError", () => {
    if (ServerParseError.is(error)) {
      expectTypeOf(error).toEqualTypeOf<ServerParseError>();
    }
  });

  test("type narrows UnconventionalError", () => {
    if (UnconventionalError.is(error)) {
      expectTypeOf(error).toEqualTypeOf<UnconventionalError>();
    }
  });
});
