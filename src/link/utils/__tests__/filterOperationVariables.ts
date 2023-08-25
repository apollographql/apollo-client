import gql from "graphql-tag";
import { filterOperationVariables } from "../filterOperationVariables";

const sampleQueryWithVariables = gql`
  query MyQuery($a: Int!) {
    stub(a: $a) {
      id
    }
  }
`;

const sampleQueryWithoutVariables = gql`
  query MyQuery {
    stub {
      id
    }
  }
`;

describe("filterOperationVariables", () => {
  it("filters unused variables", () => {
    const variables = { a: 1, b: 2, c: 3 };
    const result = filterOperationVariables(
      variables,
      sampleQueryWithoutVariables
    );
    expect(result).toEqual({});
  });

  it("does not filter used variables", () => {
    const variables = { a: 1, b: 2, c: 3 };
    const result = filterOperationVariables(
      variables,
      sampleQueryWithVariables
    );
    expect(result).toEqual({ a: 1 });
  });
});
