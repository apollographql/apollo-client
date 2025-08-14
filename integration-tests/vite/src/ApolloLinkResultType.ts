import type { ApolloLink } from "@apollo/client";
import type { FormattedExecutionResult } from "graphql";

// ensure that without manual addition to `TypeOverrides`,
// `ApolloLink.Result` equals `FormattedExecutionResult`
// with no additional alternatives

type TData = { foo: string };
type TExtensions = { bar: number };
expectTypeOf<ApolloLink.Result<TData, TExtensions>>().toEqualTypeOf<
  FormattedExecutionResult<TData, TExtensions>
>();
