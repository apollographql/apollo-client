import { gql } from "graphql-tag";

import { InvariantError } from "@apollo/client/utilities/invariant";

// eslint-disable-next-line local-rules/no-relative-imports
import { validateRequest } from "../validateRequest.js";

describe("validateOperation", () => {
  it("should throw when invalid field in operation", () => {
    expect(() => validateRequest(<any>{ qwerty: "" })).toThrow();
  });

  it("should not throw when valid fields in operation", () => {
    expect(() =>
      validateRequest({
        query: gql`
          query SampleQuery {
            stub {
              id
            }
          }
        `,
        context: {},
        variables: {},
      })
    ).not.toThrow();
  });

  it("throws when query is a string", () => {
    expect(() => {
      validateRequest({ query: "query { foo }" } as any);
    }).toThrow(
      new InvariantError(
        '`query` must be a parsed GraphQL document. Perhaps you need to wrap the query string in a "gql" tag?'
      )
    );
  });
});
