import { gql } from "graphql-tag";

import { selectURI } from "@apollo/client/link/http";
import { createOperationWithDefaultContext as createOperation } from "@apollo/client/testing/internal";

const query = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

describe("selectURI", () => {
  it("returns a passed in string", () => {
    const uri = "/somewhere";
    const operation = createOperation({ query, context: { uri } });
    expect(selectURI(operation)).toEqual(uri);
  });

  it("returns a fallback of /graphql", () => {
    const uri = "/graphql";
    const operation = createOperation({ query });
    expect(selectURI(operation)).toEqual(uri);
  });

  it("returns the result of a UriFunction", () => {
    const uri = "/somewhere";
    const operation = createOperation({ query });
    expect(selectURI(operation, () => uri)).toEqual(uri);
  });
});
