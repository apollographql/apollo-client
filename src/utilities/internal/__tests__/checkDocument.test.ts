import { gql } from "@apollo/client";
import { checkDocument } from "@apollo/client/utilities/internal";
import { OperationTypeNode } from "graphql";

test("should correctly check a document for correctness", () => {
  const multipleQueries = gql`
    query {
      author {
        firstName
        lastName
      }
    }

    query {
      author {
        address
      }
    }
  `;
  expect(() => {
    checkDocument(multipleQueries);
  }).toThrow();

  const namedFragment = gql`
    query {
      author {
        ...authorDetails
      }
    }

    fragment authorDetails on Author {
      firstName
      lastName
    }
  `;
  expect(() => {
    checkDocument(namedFragment);
  }).not.toThrow();
});

test("caches the result of checking a valid document", () => {
  const query = gql`
    query {
      me
    }
  `;
  checkDocument(query, OperationTypeNode.QUERY);
  expect(checkDocument.peek(query, OperationTypeNode.QUERY)).toBeDefined();
});

test("does not cache the result of checking an invalid document", () => {
  const query = gql`
    query {
      __typename: me
    }
  `;
  try {
    checkDocument(query, OperationTypeNode.QUERY);
  } catch {}
  expect(checkDocument.peek(query, OperationTypeNode.QUERY)).not.toBeDefined();
});
