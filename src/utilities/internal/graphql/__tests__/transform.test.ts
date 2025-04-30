import { gql } from "@apollo/client";
import { addTypenameToDocument } from "@apollo/client/utilities";
import {
  removeClientSetsFromDocument,
  removeDirectivesFromDocument,
  removeFragmentSpreadFromDocument,
} from "@apollo/client/utilities/internal";

describe("removeDirectivesFromDocument", () => {
  it("should remove inline fragments using a directive", () => {
    const query = gql`
      query Simple {
        networkField
        field {
          ... on TypeA {
            typeAThing
          }
          ... on TypeB @client {
            typeBThing @client
          }
        }
      }
    `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Simple {
        networkField
        field {
          ... on TypeA {
            typeAThing
          }
        }
      }
    `);
  });

  it("should not remove unused variable definitions unless the field is removed", () => {
    const query = gql`
      query Simple($variable: String!) {
        field(usingVariable: $variable) @client
        networkField
      }
    `;

    const doc = removeDirectivesFromDocument([{ name: "client" }], query);

    expect(doc).toMatchDocument(gql`
      query Simple($variable: String!) {
        field(usingVariable: $variable)
        networkField
      }
    `);
  });

  it("should remove unused variable definitions associated with the removed directive", () => {
    const query = gql`
      query Simple($variable: String!) {
        field(usingVariable: $variable) @client
        networkField
      }
    `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Simple {
        networkField
      }
    `);
  });

  it("should not remove used variable definitions", () => {
    const query = gql`
      query Simple($variable: String!) {
        field(usingVariable: $variable) @client
        networkField(usingVariable: $variable)
      }
    `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Simple($variable: String!) {
        networkField(usingVariable: $variable)
      }
    `);
  });

  it("should remove fragment spreads and definitions associated with the removed directive", () => {
    const query = gql`
      query Simple {
        networkField
        field @client {
          ...ClientFragment
        }
      }

      fragment ClientFragment on Thing {
        otherField
        bar
      }
    `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Simple {
        networkField
      }
    `);
  });

  it("should not remove fragment spreads and definitions used without the removed directive", () => {
    const query = gql`
      query Simple {
        networkField {
          ...ClientFragment
        }
        field @client {
          ...ClientFragment
        }
      }

      fragment ClientFragment on Thing {
        otherField
        bar
      }
    `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Simple {
        networkField {
          ...ClientFragment
        }
      }

      fragment ClientFragment on Thing {
        otherField
        bar
      }
    `);
  });

  it("should remove a simple directive", () => {
    const query = gql`
      query Simple {
        field @storage(if: true)
      }
    `;

    const doc = removeDirectivesFromDocument([{ name: "storage" }], query);

    expect(doc).toMatchDocument(gql`
      query Simple {
        field
      }
    `);
  });

  it("should remove a simple directive [test function]", () => {
    const query = gql`
      query Simple {
        field @storage(if: true)
      }
    `;

    const test = ({ name: { value } }: { name: any }) => value === "storage";
    const doc = removeDirectivesFromDocument([{ test }], query);

    expect(doc).toMatchDocument(gql`
      query Simple {
        field
      }
    `);
  });

  it("should remove only the wanted directive", () => {
    const query = gql`
      query Simple {
        maybe @skip(if: false)
        field @storage(if: true)
      }
    `;

    const doc = removeDirectivesFromDocument([{ name: "storage" }], query);

    expect(doc).toMatchDocument(gql`
      query Simple {
        maybe @skip(if: false)
        field
      }
    `);
  });

  it("should remove only the wanted directive [test function]", () => {
    const query = gql`
      query Simple {
        maybe @skip(if: false)
        field @storage(if: true)
      }
    `;

    const test = ({ name: { value } }: { name: any }) => value === "storage";
    const doc = removeDirectivesFromDocument([{ test }], query);

    expect(doc).toMatchDocument(gql`
      query Simple {
        maybe @skip(if: false)
        field
      }
    `);
  });

  it("should remove multiple directives in the query", () => {
    const query = gql`
      query Simple {
        field @storage(if: true)
        other: field @storage
      }
    `;

    const doc = removeDirectivesFromDocument([{ name: "storage" }], query);

    expect(doc).toMatchDocument(gql`
      query Simple {
        field
        other: field
      }
    `);
  });

  it("should remove multiple directives of different kinds in the query", () => {
    const query = gql`
      query Simple {
        maybe @skip(if: false)
        field @storage(if: true)
        other: field @client
      }
    `;

    const removed = [
      { name: "storage" },
      {
        test: (directive: any) => directive.name.value === "client",
      },
    ];
    const doc = removeDirectivesFromDocument(removed, query);

    expect(doc).toMatchDocument(gql`
      query Simple {
        maybe @skip(if: false)
        field
        other: field
      }
    `);
  });

  it("should remove a simple directive and its field if needed", () => {
    const query = gql`
      query Simple {
        field @storage(if: true)
        keep
      }
    `;

    const doc = removeDirectivesFromDocument(
      [{ name: "storage", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Simple {
        keep
      }
    `);
  });

  it("should remove a simple directive [test function]", () => {
    const query = gql`
      query Simple {
        field @storage(if: true)
        keep
      }
    `;

    const test = ({ name: { value } }: { name: any }) => value === "storage";
    const doc = removeDirectivesFromDocument([{ test, remove: true }], query);

    expect(doc).toMatchDocument(gql`
      query Simple {
        keep
      }
    `);
  });

  it("should return null if the query is no longer valid", () => {
    const query = gql`
      query Simple {
        field @storage(if: true)
      }
    `;

    const doc = removeDirectivesFromDocument(
      [{ name: "storage", remove: true }],
      query
    );

    expect(doc).toBe(null);
  });

  it("should return null if the query is no longer valid [test function]", () => {
    const query = gql`
      query Simple {
        field @storage(if: true)
      }
    `;

    const test = ({ name: { value } }: { name: any }) => value === "storage";
    const doc = removeDirectivesFromDocument([{ test, remove: true }], query);

    expect(doc).toBe(null);
  });

  it("should not return null if nothing was removed", () => {
    const query = gql`
      query Simple {
        ...fragmentSpread
      }

      fragment fragmentSpread on Thing {
        field
      }
    `;

    const doc = removeDirectivesFromDocument(
      [{ name: "storage", remove: true }],
      query
    );

    expect(doc).toBe(query);
  });

  it("should return null only if the query is not valid through nested fragments", () => {
    const query = gql`
      query Simple {
        ...fragmentSpread
      }

      fragment fragmentSpread on Thing {
        ...inDirection
      }

      fragment inDirection on Thing {
        field @storage
      }
    `;

    const doc = removeDirectivesFromDocument(
      [{ name: "storage", remove: true }],
      query
    );

    expect(doc).toBe(null);
  });

  it("should only remove values asked through nested fragments", () => {
    const query = gql`
      query Simple {
        ...fragmentSpread
      }

      fragment fragmentSpread on Thing {
        ...inDirection
      }

      fragment inDirection on Thing {
        field @storage
        bar
      }
    `;

    const doc = removeDirectivesFromDocument(
      [{ name: "storage", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Simple {
        ...fragmentSpread
      }

      fragment fragmentSpread on Thing {
        ...inDirection
      }

      fragment inDirection on Thing {
        bar
      }
    `);
  });

  it("should return null even through fragments if needed", () => {
    const query = gql`
      query Simple {
        ...fragmentSpread
      }

      fragment fragmentSpread on Thing {
        field @storage
      }
    `;

    const doc = removeDirectivesFromDocument(
      [{ name: "storage", remove: true }],
      query
    );

    expect(doc).toBe(null);
  });

  it("should not throw in combination with addTypenameToDocument", () => {
    const query = gql`
      query Simple {
        ...fragmentSpread
      }

      fragment fragmentSpread on Thing {
        ...inDirection
      }

      fragment inDirection on Thing {
        field @storage
      }
    `;

    expect(() => {
      removeDirectivesFromDocument(
        [{ name: "storage", remove: true }],
        addTypenameToDocument(query)
      );
    }).not.toThrow();
  });
});

describe("removeClientSetsFromDocument", () => {
  it("should remove @client fields from document", () => {
    const query = gql`
      query Author {
        name
        isLoggedIn @client
      }
    `;

    const doc = removeClientSetsFromDocument(query);

    expect(doc).toMatchDocument(gql`
      query Author {
        name
      }
    `);
  });

  it("should remove @client fields from fragments", () => {
    const query = gql`
      fragment authorInfo on Author {
        name
        isLoggedIn @client
      }
    `;

    const doc = removeClientSetsFromDocument(query);

    expect(doc).toMatchDocument(gql`
      fragment authorInfo on Author {
        name
      }
    `);
  });

  it("should remove @client and __typename only fragment when query precedes fragment", () => {
    const query = gql`
      query {
        author {
          name
          ...toBeRemoved
        }
      }

      fragment toBeRemoved on Author {
        __typename
        isLoggedIn @client
      }
    `;

    const doc = removeClientSetsFromDocument(query);

    expect(doc).toMatchDocument(gql`
      query {
        author {
          name
        }
      }
    `);
  });

  it("should remove @client and __typename only fragment when fragment precedes query", () => {
    const query = gql`
      fragment toBeRemoved on Author {
        __typename
        isLoggedIn @client
      }

      query {
        author {
          name
          ...toBeRemoved
        }
      }
    `;

    const doc = removeClientSetsFromDocument(query);

    expect(doc).toMatchDocument(gql`
      query {
        author {
          name
        }
      }
    `);
  });

  it("should not remove __typename-only fragment (without @client) when query precedes fragment", () => {
    const query = gql`
      query {
        author {
          name
          ...authorInfo
        }
      }

      fragment authorInfo on Author {
        __typename
      }
    `;

    const doc = removeClientSetsFromDocument(query);

    expect(doc).toMatchDocument(query);
  });

  it("should not remove __typename-only fragment (without @client) when fragment precedes query", () => {
    const query = gql`
      fragment authorInfo on Author {
        __typename
      }

      query {
        author {
          name
          ...authorInfo
        }
      }
    `;

    const doc = removeClientSetsFromDocument(query);

    expect(doc).toMatchDocument(query);
  });

  it("should not remove fragment referenced by fragment used by operation", () => {
    const query = gql`
      query {
        author {
          name
          ...authorInfo
        }
      }

      fragment authorInfo on Author {
        __typename
        ...moreAuthorInfo
      }

      fragment moreAuthorInfo on Author {
        extraDetails
        isLoggedIn @client
      }
    `;

    const doc = removeClientSetsFromDocument(query);

    expect(doc).toMatchDocument(gql`
      query {
        author {
          name
          ...authorInfo
        }
      }

      fragment authorInfo on Author {
        __typename
        ...moreAuthorInfo
      }

      fragment moreAuthorInfo on Author {
        extraDetails
      }
    `);
  });

  it("should remove __typename only fragment after @client removal", () => {
    const query = gql`
      query {
        author {
          name
          ...authorInfo
        }
      }

      fragment authorInfo on Author {
        __typename
        ...moreAuthorInfo @client
      }

      fragment moreAuthorInfo on Author {
        extraDetails
        isLoggedIn @client
      }
    `;

    const expected = gql`
      query {
        author {
          name
        }
      }
    `;

    const doc = removeClientSetsFromDocument(query);

    expect(doc).toMatchDocument(expected);

    const queryInAnotherOrder = gql`
      fragment moreAuthorInfo on Author {
        extraDetails
        isLoggedIn @client
      }

      fragment authorInfo on Author {
        __typename
        ...moreAuthorInfo @client
      }

      query {
        author {
          name
          ...authorInfo
        }
      }
    `;

    const docInAnotherOrder = removeClientSetsFromDocument(queryInAnotherOrder);

    expect(docInAnotherOrder).toMatchDocument(expected);
  });

  it("should keep moreAuthorInfo fragment if used elsewhere", () => {
    const query = gql`
      query {
        author {
          name
          ...authorInfo
          ...moreAuthorInfo
        }
      }

      fragment authorInfo on Author {
        __typename
        ...moreAuthorInfo @client
      }

      fragment moreAuthorInfo on Author {
        extraDetails
        isLoggedIn @client
      }
    `;

    const expected = gql`
      query {
        author {
          name
          ...moreAuthorInfo
        }
      }

      fragment moreAuthorInfo on Author {
        extraDetails
      }
    `;

    const doc = removeClientSetsFromDocument(query);

    expect(doc).toMatchDocument(expected);

    const queryInAnotherOrder = gql`
      fragment authorInfo on Author {
        ...moreAuthorInfo @client
        __typename
      }

      query {
        author {
          name
          ...authorInfo
          ...moreAuthorInfo
        }
      }

      fragment moreAuthorInfo on Author {
        isLoggedIn @client
        extraDetails
      }
    `;

    const docInAnotherOrder = removeClientSetsFromDocument(queryInAnotherOrder);

    expect(docInAnotherOrder).toMatchDocument(expected);
  });

  it("should remove unused variables in nested fragments", () => {
    const query = gql`
      query SomeQuery($someVar: String) {
        someField {
          ...SomeFragment
        }
      }

      fragment SomeFragment on SomeType {
        firstField {
          ...SomeOtherFragment
        }
      }

      fragment SomeOtherFragment on SomeType {
        someField @client(someArg: $someVar)
      }
    `;

    const doc = removeClientSetsFromDocument(query);

    expect(doc).toMatchDocument(gql`
      query SomeQuery {
        someField {
          ...SomeFragment
        }
      }

      fragment SomeFragment on SomeType {
        firstField
      }
    `);
  });

  it("should not remove variables used in unremoved parts of query", () => {
    const query = gql`
      query SomeQuery($someVar: String) {
        someField {
          ...SomeFragment
        }
      }

      fragment SomeFragment on SomeType {
        firstField {
          ...SomeOtherFragment
        }
      }

      fragment SomeOtherFragment on SomeType {
        someField(someArg: $someVar) @client
        yetAnotherField(someArg: $someVar)
      }
    `;

    const doc = removeClientSetsFromDocument(query);

    expect(doc).toMatchDocument(gql`
      query SomeQuery($someVar: String) {
        someField {
          ...SomeFragment
        }
      }

      fragment SomeFragment on SomeType {
        firstField {
          ...SomeOtherFragment
        }
      }

      fragment SomeOtherFragment on SomeType {
        yetAnotherField(someArg: $someVar)
      }
    `);
  });
});

describe("removeFragmentSpreadFromDocument", () => {
  it("should remove a named fragment spread", () => {
    const query = gql`
      query Simple {
        ...FragmentSpread
        property
        ...ValidSpread
      }

      fragment FragmentSpread on Thing {
        foo
        bar
        baz
      }

      fragment ValidSpread on Thing {
        oof
        rab
        zab
      }
    `;

    const doc = removeFragmentSpreadFromDocument(
      [{ name: "FragmentSpread", remove: true }],
      query
    )!;

    expect(doc).toMatchDocument(gql`
      query Simple {
        property
        ...ValidSpread
      }

      fragment ValidSpread on Thing {
        oof
        rab
        zab
      }
    `);
  });
});
