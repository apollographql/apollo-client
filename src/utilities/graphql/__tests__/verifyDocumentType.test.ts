import { OperationTypeNode } from "graphql";
import { gql } from "graphql-tag";

import { verifyDocumentType } from "@apollo/client/utilities";

describe("verifyDocumentType", () => {
  it("should error if both a query and a mutation is present", () => {
    const query = gql`
      query {
        user {
          name
        }
      }

      mutation ($t: String) {
        addT(t: $t) {
          user {
            name
          }
        }
      }
    `;

    expect(() =>
      verifyDocumentType(query, OperationTypeNode.QUERY)
    ).toThrowError(/react-apollo only supports/);
  });

  it("should error if multiple operations are present", () => {
    const query = gql`
      query One {
        user {
          name
        }
      }

      query Two {
        user {
          name
        }
      }
    `;

    expect(() =>
      verifyDocumentType(query, OperationTypeNode.QUERY)
    ).toThrowError(/react-apollo only supports/);
  });

  it("should error if not a DocumentNode", () => {
    const query = `
      query One { user { name } }
    `;
    expect(() =>
      verifyDocumentType(query as any, OperationTypeNode.QUERY)
    ).toThrowError(/not a valid GraphQL DocumentNode/);
  });
});
