import type {
  FormattedExecutionResult,
  FormattedInitialIncrementalExecutionResult,
  FormattedSubsequentIncrementalExecutionResult,
  GraphQLSchema,
} from "graphql-17-alpha9";
import { experimentalExecuteIncrementally } from "graphql-17-alpha9";

import type { DocumentNode } from "@apollo/client";

export async function* executeSchemaGraphQL17Alpha9(
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue: unknown = {}
): AsyncGenerator<
  | FormattedInitialIncrementalExecutionResult
  | FormattedSubsequentIncrementalExecutionResult
  | FormattedExecutionResult,
  void
> {
  const result = await experimentalExecuteIncrementally({
    schema,
    document,
    rootValue,
  });

  if ("initialResult" in result) {
    yield JSON.parse(JSON.stringify(result.initialResult));

    for await (const patch of result.subsequentResults) {
      yield JSON.parse(JSON.stringify(patch));
    }
  } else {
    yield JSON.parse(JSON.stringify(result));
  }
}
