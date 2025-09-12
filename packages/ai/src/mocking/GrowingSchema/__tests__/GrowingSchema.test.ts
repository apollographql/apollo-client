import { gql } from "@apollo/client";
import { GrowingSchema } from "../GrowingSchema.js";

describe("GrowingSchema", () => {
  it("creates an empty base schema when instantiated", () => {
    const expectedSchema = /* GraphQL */ ``;
    const schema = new GrowingSchema();
    expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
  });

  describe(".add()", () => {
    it("creates a query schema with the correct fields", async () => {
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
          aliases
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
            aliases: ["John Smith", "Who Knows"],
          },
        },
      };
      const expectedSchema = /* GraphQL */ `
        type Query {
          user: User
        }

        type Email {
          id: ID!
          kind: String
          value: String
        }

        type User {
          aliases: [String]
          emails: [Email]
          id: ID!
          name: String
        }
      `;
      const schema = new GrowingSchema();
      await schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("creates a query schema with the correct fields from a base schema", async () => {
      const baseSchema = /* GraphQL */ `
        scalar DateTime

        type Query {
          now: DateTime
        }
      `;
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
          aliases
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
            aliases: ["John Smith", "Who Knows"],
          },
        },
      };
      const expectedSchema = /* GraphQL */ `
        type Query {
          now: DateTime
          user: User
        }

        scalar DateTime

        type Email {
          id: ID!
          kind: String
          value: String
        }

        type User {
          aliases: [String]
          emails: [Email]
          id: ID!
          name: String
        }
      `;
      const schema = new GrowingSchema({ schema: baseSchema });
      await schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("creates a mutation schema with the correct fields", async () => {
      const query = gql`
      mutation CreateUser {
        createUser {
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
          createUser: {
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
          _placeholder_query_: Boolean
        }

        type Mutation {
          createUser: User
        }

        type Email {
          id: ID!
          kind: String
          value: String
        }

        type User {
          emails: [Email]
          id: ID!
          name: String
        }
      `;
      const schema = new GrowingSchema();
      await schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("extends an existing schema based on a new query", async () => {
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

        type Email {
          foo: Int
          id: ID!
          kind: String
          value: String
        }

        type User {
          emails: [Email]
          id: ID!
          lastName: String
          name: String
        }
      `;
      const schema = new GrowingSchema();
      await schema.add({ query }, response);
      schema.add({ query: query2 }, response2);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("avoids errors due to race conditions when adding multiple queries simultaneously", async () => {
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

        type Email {
          foo: Int
          id: ID!
          kind: String
          value: String
        }

        type User {
          emails: [Email]
          id: ID!
          lastName: String
          name: String
        }
      `;
      const schema = new GrowingSchema();
      const promises = [
        schema.add({ query: query2 }, response2),
        schema.add({ query }, response),
      ];
      await Promise.all(promises);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("throws an error when a query that is incompatible with previous queries is added", async () => {
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
          id: ID!
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
      await schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);

      // Attempt to add the incompatible schema
      let error: Error | undefined;
      try {
        await schema.add({ query: query2 }, response2);
      } catch (err) {
        error = err as Error;
      }

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toEqual(
        'Error executing query `GetUser2` against grown schema: Expected Iterable, but did not find one for field "Query.users".'
      );
    });

    it("handles inline arguments", async () => {
      const query = gql`
      query Search {
        book(
          id: "asdf"
          nullArg: null
          stringArg: "Hi"
          boolArg: false
          intArg: 2
          floatArg: 3.6
          listArg: ["string1", "string2"]
          nestedListArg: [["nested1"], ["nested2, nested3"]]
          objectArg: {
            prop1: true,
            prop2: 5,
            prop3: 9.7,
            prop4: "Hello",
            prop5: null,
            prop6: {value: "Yep"}
            prop7: ["Yep"],
            prop8: [[7]],
            prop9: [{value1: "Nope"}, {value2: true}, {value2: false}]
          }
          objectArgs: [{prop1: true}, {prop1: false}, {prop2: 5}]
          nestedObjectArgs: [[{prop1: true}], [{prop1: false}], [{prop2: 5}]]
        ) {
          __typename
          title
          anotherField(number: 1, bool: true)
        }
      }
      `;
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
          book(
            boolArg: Boolean,
            floatArg: Float,
            id: ID,
            intArg: Int,
            listArg: [String],
            nestedListArg: [[String]],
            nestedObjectArgs: [[NestedObjectArgInput]],
            nullArg: String,
            objectArg: ObjectArgInput,
            objectArgs: [ObjectArgInput],
            stringArg: String
          ): Book
        }

        type Book {
          anotherField(bool: Boolean, number: Int): Boolean
          title: String
        }

        input NestedObjectArgInput {
          prop1: Boolean
          prop2: Int
        }

        input ObjectArgInput {
          prop1: Boolean
          prop2: Int
          prop3: Float
          prop4: String
          prop5: String
          prop6: Prop6Input
          prop7: [String]
          prop8: [[Int]]
          prop9: [Prop9Input]
        }

        input Prop6Input {
          value: String
        }

        input Prop9Input {
          value1: String
          value2: Boolean
        }
      `;

      const schema = new GrowingSchema();
      await schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("handles scalar variables", async () => {
      const query = gql`
      query Search($bookId: ID!, $arg: String!, $nullable: String) {
        book(id: $bookId) {
          __typename
          title
          anotherField(arg: $arg, nullable: $nullable)
        }
      }
      `;
      const variables = {
        bookId: "ASDF",
        arg: "QWERTY",
        nullable: null,
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
          book(id: ID!): Book
        }

        type Book {
          anotherField(arg: String!, nullable: String): Boolean
          title: String
        }
      `;

      const schema = new GrowingSchema();
      await schema.add({ query, variables }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("handles input object variables", async () => {
      const query = gql`
      query SearchByAuthor($author: AuthorInput!, $arg: SomeArgInput!) {
        bookByAuthor(author: $author) {
          __typename
          title
          anotherField(arg: $arg)
        }
      }
      `;
      const variables = {
        author: {
          name: "John Smith",
        },
        arg: {
          foo: null,
        },
      };
      const response = {
        data: {
          bookByAuthor: {
            __typename: "Book",
            title: "The Tardis",
            anotherField: true,
          },
        },
      };
      const expectedSchema = /* GraphQL */ `
        type Query {
          bookByAuthor(author: AuthorInput!): Book
        }

        input AuthorInput {
          name: String
        }

        type Book {
          anotherField(arg: SomeArgInput!): Boolean
          title: String
        }

        input SomeArgInput {
          foo: String
        }
      `;

      const schema = new GrowingSchema();
      await schema.add({ query, variables }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("handles nested input object variables", async () => {
      const query = gql`
      query SearchByAuthor($author: AuthorInput!) {
        bookByAuthor(author: $author) {
          __typename
          title
        }
      }
      `;
      const variables = {
        author: {
          name: {
            firstName: "John",
            lastName: "Smith",
            nickName: {
              full: "The Doctor",
              short: "Dr.",
            },
            age: 2000,
          },
        },
      };
      const response = {
        data: {
          bookByAuthor: {
            __typename: "Book",
            title: "The Tardis",
          },
        },
      };
      const expectedSchema = /* GraphQL */ `
        type Query {
          bookByAuthor(author: AuthorInput!): Book
        }

        input AuthorInput {
          name: NameInput
        }

        type Book {
          title: String
        }

        input NameInput {
          age: Int
          firstName: String
          lastName: String
          nickName: NickNameInput
        }

        input NickNameInput {
          full: String
          short: String
        }
      `;

      const schema = new GrowingSchema();
      schema.add({ query, variables }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("handles repeated input object variables for a single query", async () => {
      const query = gql`
      query SearchByAuthor($author: AuthorInput!) {
        bookByAuthor(author: $author) {
          __typename
          title
          anotherField(author: $author)
        }
      }
      `;
      const variables = {
        author: {
          name: {
            firstName: "John",
            lastName: "Smith",
            nickName: {
              full: "The Doctor",
              short: "Dr.",
            },
            age: 2000,
          },
        },
      };
      const response = {
        data: {
          bookByAuthor: {
            __typename: "Book",
            title: "The Tardis",
            anotherField: true,
          },
        },
      };
      const expectedSchema = /* GraphQL */ `
        type Query {
          bookByAuthor(author: AuthorInput!): Book
        }

        input AuthorInput {
          name: NameInput
        }

        type Book {
          anotherField(author: AuthorInput!): Boolean
          title: String
        }

        input NameInput {
          age: Int
          firstName: String
          lastName: String
          nickName: NickNameInput
        }

        input NickNameInput {
          full: String
          short: String
        }
      `;

      const schema = new GrowingSchema();
      await schema.add({ query, variables }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("handles repeated input object variables across multiple queries", async () => {
      const firstQuery = gql`
      query SearchByAuthor($author: AuthorInput!) {
        bookByAuthor(author: $author) {
          __typename
          title
        }
      }
      `;
      const firstVariables = {
        author: {
          name: {
            nickName: {
              full: "The Doctor",
            },
          },
        },
      };
      const firstResponse = {
        data: {
          bookByAuthor: {
            __typename: "Book",
            title: "The Tardis",
          },
        },
      };
      const firstExpectedSchema = /* GraphQL */ `
        type Query {
          bookByAuthor(author: AuthorInput!): Book
        }

        input AuthorInput {
          name: NameInput
        }

        type Book {
          title: String
        }

        input NameInput {
          nickName: NickNameInput
        }

        input NickNameInput {
          full: String
        }
      `;
      const secondQuery = gql`
      query SearchByAuthor($author: AuthorInput!) {
        bookByAuthor(author: $author) {
          __typename
          title
        }
      }
      `;
      const secondVariables = {
        author: {
          name: {
            firstName: "John",
            lastName: "Smith",
            nickName: {
              short: "Dr.",
            },
          },
        },
      };
      const secondResponse = {
        data: {
          bookByAuthor: {
            __typename: "Book",
            title: "The Tardis",
          },
        },
      };
      const secondExpectedSchema = /* GraphQL */ `
        type Query {
          bookByAuthor(author: AuthorInput!): Book
        }

        input AuthorInput {
          name: NameInput
        }

        type Book {
          title: String
        }

        input NameInput {
          firstName: String
          lastName: String
          nickName: NickNameInput
        }

        input NickNameInput {
          full: String
          short: String
        }
      `;

      const schema = new GrowingSchema();
      await schema.add(
        { query: firstQuery, variables: firstVariables },
        firstResponse
      );
      expect(schema.toString()).toEqualIgnoringWhitespace(firstExpectedSchema);

      await schema.add(
        { query: secondQuery, variables: secondVariables },
        secondResponse
      );
      expect(schema.toString()).toEqualIgnoringWhitespace(secondExpectedSchema);
    });

    it("handles list variables", async () => {
      const query = gql`
      query SearchByAuthor($authors: [AuthorInput!]!) {
        bookByAuthor(authors: $authors) {
          __typename
          title
        }
      }
      `;
      const variables = {
        authors: [
          {
            name: {
              nickNames: [
                {
                  full: "The Doctor",
                },
              ],
            },
          },
          {
            name: {
              firstName: "Sarah",
              middleName: "Jane",
              lastName: "Smith",
            },
          },
        ],
      };
      const response = {
        data: {
          bookByAuthor: {
            __typename: "Book",
            title: "The Tardis",
          },
        },
      };
      const expectedSchema = /* GraphQL */ `
        type Query {
          bookByAuthor(authors: [AuthorInput!]!): Book
        }

        input AuthorInput {
          name: NameInput
        }

        type Book {
          title: String
        }

        input NameInput {
          firstName: String
          lastName: String
          middleName: String
          nickNames: [NickNameInput]
        }

        input NickNameInput {
          full: String
        }
      `;

      const schema = new GrowingSchema();
      await schema.add({ query, variables }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("handles a single inline fragment as a type, not a union", async () => {
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
        book: Book
      }

      type Book {
        title: String
      }
      `;

      const schema = new GrowingSchema();
      await schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("handles a single inline fragment as a type, not a union, when the return data is a list of matching types", async () => {
      const query = gql`
      query Search {
        books {
          ... on Book {
            __typename
            title
          }
        }
      }
      `;
      const response = {
        data: {
          books: [
            {
              __typename: "Book",
              title: "Moby Dick",
            },
            {
              __typename: "Book",
              title: "The Martian",
            },
          ],
        },
      };
      const expectedSchema = /* GraphQL */ `
      type Query {
        books: [Book]
      }

      type Book {
        title: String
      }
      `;

      const schema = new GrowingSchema();
      await schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("handles union types with inline fragments", async () => {
      const query = gql`
      query Search {
        search(term: "Smith", first: 2, after: "ASDF") {
          __typename
          # The inline fragments imply that this is a union
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
      `;
      const response = {
        data: {
          search: [
            // The inconsistent `__typename` values
            // imply that this is a union.
            {
              __typename: "Book",
              title: "The Art of Blacksmithing",
            },
            {
              __typename: "Author",
              name: "John Smith",
            },
          ],
        },
      };
      const expectedSchema = /* GraphQL */ `
      type Query {
        search(after: String, first: Int, term: String): [AuthorBookUnion]
      }

      type Author {
        name: String
      }

      union AuthorBookUnion = Author | Book

      type Book {
        title: String
      }
      `;

      const schema = new GrowingSchema();
      await schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("handles a selection set with root fields and inline fragments as a union, contributing the root fields to all union members", async () => {
      const query = gql`
      query Search {
        search {
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
                  __typename: "Movie",
                  title: "The Matrix",
                  someField: true,
                },
              },
              {
                __typename: "SearchEdge",
                node: {
                  __typename: "Book",
                  title: "The Art of Blacksmithing",
                  someOtherField: false,
                },
              },
            ],
          },
        },
      };
      const expectedSchema = /* GraphQL */ `
      type Query {
        search: SearchConnection
      }

      type Book {
        someOtherField: Boolean
        title: String
      }

      union BookMovieUnion = Book | Movie

      type Movie {
        someField: Boolean
        title: String
      }

      type PageInfo {
        hasNextPage: Boolean
        nextCursor: String
      }

      type SearchConnection {
        edges: [SearchEdge]
        pageInfo: PageInfo
      }

      type SearchEdge {
        node: BookMovieUnion
      }
      `;

      const schema = new GrowingSchema();
      await schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("handles named fragments on a type", async () => {
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
        book: Book
      }

      type Book {
        title: String
      }
      `;

      const schema = new GrowingSchema();
      await schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });

    it("handles union types with named fragments", async () => {
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
        search(after: String, first: Int, term: String): SearchConnection
      }

      type Author {
        name: String
      }

      union AuthorBookUnion = Author | Book

      type Book {
        title: String
      }

      type PageInfo {
        hasNextPage: Boolean
        nextCursor: String
      }

      type SearchConnection {
        edges: [SearchEdge]
        pageInfo: PageInfo
      }

      type SearchEdge {
        node: AuthorBookUnion
      }
      `;

      const schema = new GrowingSchema();
      await schema.add({ query }, response);
      expect(schema.toString()).toEqualIgnoringWhitespace(expectedSchema);
    });
  });
});
