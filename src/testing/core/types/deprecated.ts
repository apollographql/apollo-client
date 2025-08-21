import type { OperationVariables } from "@apollo/client";

import type { MockLink } from "../mocking/mockLink.js";

/** @deprecated Use `MockLink.MockedRequest` instead */
export type MockedRequest<
  TVariables extends OperationVariables = Record<string, any>,
> = MockLink.MockedRequest<TVariables>;

/** @deprecated Use `MockLink.MockedResponse` instead */
export type MockedResponse<
  TData = Record<string, any>,
  TVariables extends OperationVariables = Record<string, any>,
> = MockLink.MockedResponse<TData, TVariables>;

/** @deprecated Use `MockLink.Options` instead */
export type MockLinkOptions = MockLink.Options;

/** @deprecated Use `MockLink.ResultFunction` instead */
export type ResultFunction<
  T,
  V = Record<string, any>,
> = MockLink.ResultFunction<T, V>;
