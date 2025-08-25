import { gql } from "@apollo/client";
import { GrowingSchema } from "../GrowingSchema.js";
import { GraphQLError } from "graphql";

describe("GrowingSchema", () => {
  it("creates a base schema when instantiated", () => {
    const schema = new GrowingSchema();
    expect(schema.toString()).toEqualIgnoringWhitespace(/* GraphQL */ `
      type Query
    `);
  });

  describe(".add()", () => {
    it("should create a schema with the correct fields", () => {
      const query = gql`
      query GetUser {
        user {
          __typename
          id
          name
          emails {
            __typename
            id
            kind
            value
          }
        }
      }
      `;
      const response = {
        data: {
          user: {
            __typename: "User",
            id: "1",
            name: "John Doe",
            emails: [
              { __typename: "Email", id: "1", kind: "work", value: "qd" },
              { __typename: "Email", id: "2", kind: "personal", value: "qwe" },
            ],
          },
        },
      };
      const expectedSchema = /* GraphQL */ `
        type Query {
          user: User
        }

        type User {
          id: String
          name: String
          emails: [Email]
        }

        type Email {
          id: String
          kind: String
          value: String
        }
      `;
      const schema = new GrowingSchema();
      schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("extends an existing schema based on a new query", () => {
      const query = gql`
      query GetUser {
        user {
          __typename
          id
          name
          emails {
            __typename
            id
            kind
            value
          }
        }
      }
      `;
      const response = {
        data: {
          user: {
            __typename: "User",
            id: "1",
            name: "John Doe",
            emails: [
              { __typename: "Email", id: "1", kind: "work", value: "qd" },
              { __typename: "Email", id: "2", kind: "personal", value: "qwe" },
            ],
          },
        },
      };
      const query2 = gql`
      query GetUser2 {
        user {
          __typename
          lastName
          emails {
            __typename
            foo
          }
        }
      }
      `;
      const response2 = {
        data: {
          user: {
            __typename: "User",
            lastName: "John Doe",
            emails: [{ __typename: "Email", foo: 1 }],
          },
        },
      };
      const expectedSchema = /* GraphQL */ `
        type Query {
          user: User
        }

        type User {
          id: String
          name: String
          emails: [Email]
          lastName: String
        }

        type Email {
          id: String
          kind: String
          value: String
          foo: Float
        }
      `;
      const schema = new GrowingSchema();
      schema.add({ query }, response);
      schema.add({ query: query2 }, response2);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("throws an error when a query that is incompatible with previous queries is added", () => {
      const query = gql`
      query GetUsers {
        users(limit: 2) {
          __typename
          id
          name
        }
      }
      `;
      const response = {
        data: {
          users: [
            { __typename: "User", id: "1", name: "John Smith" },
            { __typename: "User", id: "2", name: "Sarah Jane Smith" },
          ],
        },
      };
      const expectedSchema = /* GraphQL */ `
        type Query {
          users(limit: Int): [User]
        }

        type User {
          id: String
          name: String
        }
      `;
      const query2 = gql`
      query GetUser2 {
        users(first: 2, after: "ASDF") {
          __typename
          edges {
            __typename
            node {
              __typename
              lastName
            }
          }
          pageInfo {
            __typename
            hasNextPage
            nextCursor
          }
        }
      }
      `;
      const response2 = {
        data: {
          users: {
            __typename: "UserConnection",
            edges: [
              {
                __typename: "UserEdge",
                node: { __typename: "User", lastName: "Smith" },
              },
              {
                __typename: "UserEdge",
                node: { __typename: "User", lastName: "Smith" },
              },
            ],
            pageInfo: {
              __typename: "PageInfo",
              hasNextPage: true,
              nextCursor: "QWERTY",
            },
          },
        },
      };

      const schema = new GrowingSchema();

      // Add the initial schema
      schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);

      // Attempt to add the incompatible schema
      let error: Error | undefined;
      try {
        schema.add({ query: query2 }, response2);
      } catch (err) {
        error = err as Error;
      }

      expect(error).toBeInstanceOf(GraphQLError);
      expect(error?.message).toEqual(
        "Field `Query.users` return type mismatch. Previously defined return type: `[User]`, new return type: `UserConnection`"
      );
    });

    it.skip("handles variables", () => {
      const query = gql`
      query Search($bookId: ID!, $arg: String!) {
        book(id: $bookId) {
          __typename
          title
          anotherField(arg: $arg)
        }
      }
      `;
      const variables = {
        bookId: "ASDF",
        arg: "QWERTY",
      };
      const response = {
        data: {
          book: {
            __typename: "Book",
            title: "Moby Dick",
            anotherField: true,
          },
        },
      };
      const expectedSchema = /* GraphQL */ `
        type Query {
        }
      `;

      const schema = new GrowingSchema();
      schema.add({ query, variables }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it.skip("handles union types with inline fragments", () => {
      const query = gql`
      query Search {
        search(term: "Smith", first: 2, after: "ASDF") {
          __typename
          pageInfo {
            __typename
            hasNextPage
            nextCursor
          }
          edges {
            __typename
            node {
              # The inline fragments imply that this is a union.
              ... on Author {
                __typename
                name
              }
              ... on Book {
                __typename
                title
              }
            }
          }
        }
      }
      `;
      const response = {
        data: {
          search: {
            __typename: "SearchConnection",
            pageInfo: {
              __typename: "PageInfo",
              hasNextPage: true,
              nextCursor: "eyJvZmZzZXQiOjJ9",
            },
            edges: [
              // The inconsistent `__typename` values
              // imply that this is a union.
              {
                __typename: "SearchEdge",
                node: {
                  __typename: "Author",
                  name: "John Smith",
                },
              },
              {
                __typename: "SearchEdge",
                node: {
                  __typename: "Book",
                  title: "The Art of Blacksmithing",
                },
              },
            ],
          },
        },
      };
      const expectedSchema = /* GraphQL */ `
      type Query {
      }
      `;

      const schema = new GrowingSchema();
      schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it.skip("handles a single inline fragment as a union", () => {
      const query = gql`
      query Search {
        book {
          ... on Book {
            __typename
            title
          }
        }
      }
      `;
      const response = {
        data: {
          book: {
            __typename: "Book",
            title: "Moby Dick",
          },
        },
      };
      const expectedSchema = /* GraphQL */ `
      type Query {
      }
      `;

      const schema = new GrowingSchema();
      schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it.skip("handles a selection set with root fields and inline fragments as a union, contributing the root fields to all union members", () => {
      const query = gql`
      query Search($term: String!, $first: Int, $after: String) {
        search(term: $term, first: $first, after: $after) {
          __typename
          pageInfo {
            __typename
            hasNextPage
            nextCursor
          }
          edges {
            __typename
            node {
              __typename
              # The root field should imply that this
              # is an interface, not a union.
              title
              ... on Movie {
                __typename
                someField
              }
              ... on Book {
                __typename
                someOtherField
              }
            }
          }
        }
      }
      `;
      const response = {
        data: {
          search: {
            __typename: "SearchConnection",
            pageInfo: {
              __typename: "PageInfo",
              hasNextPage: true,
              nextCursor: "eyJvZmZzZXQiOjJ9",
            },
            edges: [
              // The inconsistent `__typename` values
              // could imply that this is a union, but when
              // paired with the root `id` field, it instead
              // implies that this is an interface.
              {
                __typename: "SearchEdge",
                node: {
                  __typename: "Author",
                  name: "John Smith",
                },
              },
              {
                __typename: "SearchEdge",
                node: {
                  __typename: "Book",
                  title: "The Art of Blacksmithing",
                },
              },
            ],
          },
        },
      };
      const expectedSchema = /* GraphQL */ `
      type Query {
      }
      `;

      const schema = new GrowingSchema();
      schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it.skip("handles named fragments on a type", () => {
      const query = gql`
      query Search {
        book {
          ...BookFragment
        }
      }

      fragment BookFragment on Book {
        __typename
        title
      }
      `;
      const response = {
        data: {
          book: {
            __typename: "Book",
            title: "Moby Dick",
          },
        },
      };
      const expectedSchema = /* GraphQL */ `
      type Query {
      }
      `;

      const schema = new GrowingSchema();
      schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it.skip("handles union types with named fragments", () => {
      const query = gql`
      query Search {
        search(term: "Smith", first: 2, after: "ASDF") {
          __typename
          pageInfo {
            __typename
            hasNextPage
            nextCursor
          }
          edges {
            __typename
            node {
              ... AuthorFragment
              ... BookFragment
            }
          }
        }
      }

      fragment AuthorFragment on Author {
        __typename
        name
      }

      fragment BookFragment on Book {
        __typename
        title
      }
      `;
      const response = {
        data: {
          search: {
            __typename: "SearchConnection",
            pageInfo: {
              __typename: "PageInfo",
              hasNextPage: true,
              nextCursor: "eyJvZmZzZXQiOjJ9",
            },
            edges: [
              {
                __typename: "SearchEdge",
                node: {
                  __typename: "Author",
                  name: "John Smith",
                },
              },
              {
                __typename: "SearchEdge",
                node: {
                  __typename: "Book",
                  title: "The Art of Blacksmithing",
                },
              },
            ],
          },
        },
      };
      const expectedSchema = /* GraphQL */ `
      type Query {
      }
      `;

      const schema = new GrowingSchema();
      schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });
  });
});
