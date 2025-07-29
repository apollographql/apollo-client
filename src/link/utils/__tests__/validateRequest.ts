import { gql } from "graphql-tag";

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
});
