import { validateOperation } from "../validateOperation";
import gql from "graphql-tag";

describe("validateOperation", () => {
  it("should throw when invalid field in operation", () => {
    expect(() => validateOperation(<any>{ qwerty: "" })).toThrow();
  });

  it("should not throw when valid fields in operation", () => {
    expect(() =>
      validateOperation({
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
