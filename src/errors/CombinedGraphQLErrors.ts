import type { GraphQLFormattedError } from "graphql";

import type { FetchResult } from "@apollo/client";
import { getGraphQLErrorsFromResult } from "@apollo/client/utilities";

import { brand, isBranded } from "./utils.js";

export declare namespace CombinedGraphQLErrors {
  export interface MessageFormatterOptions {
    result: FetchResult<unknown>;
    defaultFormatMessage: (
      errors: ReadonlyArray<GraphQLFormattedError>
    ) => string;
  }

  export type MessageFormatter = (
    errors: ReadonlyArray<GraphQLFormattedError>,
    options: MessageFormatterOptions
  ) => string;
}

function defaultFormatMessage(errors: ReadonlyArray<GraphQLFormattedError>) {
  return (
    errors
      // Handle non-spec-compliant servers: See #1185
      .filter((e) => e)
      .map((e) => e.message || "Error message not found.")
      .join("\n")
  );
}

/**
 * Represents the combined list of GraphQL errors returned from the server in a
 * GraphQL response.
 */
export class CombinedGraphQLErrors extends Error {
  /** Determine if an error is a `CombinedGraphQLErrors` instance */
  static is(error: unknown): error is CombinedGraphQLErrors {
    return isBranded(error, "CombinedGraphQLErrors");
  }

  /**
   * Formats the error message used for the error `message` property. Override
   * to provide your own formatting.
   */
  static formatMessage: CombinedGraphQLErrors.MessageFormatter =
    defaultFormatMessage;

  /**
   * The raw list of GraphQL errors returned in a GraphQL response.
   */
  readonly errors: ReadonlyArray<GraphQLFormattedError>;

  /**
   * Partial data returned in the GraphQL response.
   */
  readonly data: Record<string, unknown> | null | undefined;

  constructor(result: FetchResult<unknown>) {
    const errors = getGraphQLErrorsFromResult(result);

    super(
      CombinedGraphQLErrors.formatMessage(errors, {
        result,
        defaultFormatMessage,
      })
    );
    this.errors = errors;
    this.data = result.data as Record<string, unknown>;
    this.name = "CombinedGraphQLErrors";

    brand(this);
    Object.setPrototypeOf(this, CombinedGraphQLErrors.prototype);
  }
}
