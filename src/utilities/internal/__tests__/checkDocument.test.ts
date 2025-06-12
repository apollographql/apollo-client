import { OperationTypeNode } from "graphql";

import { gql } from "@apollo/client";
import { checkDocument } from "@apollo/client/utilities/internal";
import { InvariantError } from "@apollo/client/utilities/invariant";

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
  let kindLookupCount = 0;
  const query = new Proxy(
    gql`
      query {
        me
      }
    `,
    {
      get(target, prop) {
        if (prop === "kind") {
          kindLookupCount++;
        }
        return Reflect.get(target, prop);
      },
    }
  );
  checkDocument(query, OperationTypeNode.QUERY);
  expect(kindLookupCount).toBeGreaterThan(0);
  kindLookupCount = 0;
  checkDocument(query, OperationTypeNode.QUERY);
  expect(kindLookupCount).toBe(0);
});

test("caches thrown errors", () => {
  let kindLookupCount = 0;
  const query = new Proxy(
    gql`
      query {
        __typename: me
      }
    `,
    {
      get(target, prop) {
        if (prop === "kind") {
          kindLookupCount++;
        }
        return Reflect.get(target, prop);
      },
    }
  );
  expect(() => checkDocument(query, OperationTypeNode.QUERY)).toThrow(
    new InvariantError(
      '`__typename` is a forbidden field alias name in the selection set for field `me` in query "(anonymous)".'
    )
  );
  expect(kindLookupCount).toBeGreaterThan(0);
  kindLookupCount = 0;
  expect(() => checkDocument(query, OperationTypeNode.QUERY)).toThrow(
    new InvariantError(
      '`__typename` is a forbidden field alias name in the selection set for field `me` in query "(anonymous)".'
    )
  );
  expect(kindLookupCount).toBe(0);
});
