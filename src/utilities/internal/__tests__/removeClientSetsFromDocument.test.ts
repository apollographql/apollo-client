import { gql } from "@apollo/client";
import { removeClientSetsFromDocument } from "@apollo/client/utilities/internal";

test("should remove @client fields from document", () => {
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

test("should remove @client fields from fragments", () => {
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

test("should remove @client and __typename only fragment when query precedes fragment", () => {
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

test("should remove @client and __typename only fragment when fragment precedes query", () => {
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

test("should not remove __typename-only fragment (without @client) when query precedes fragment", () => {
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

test("should not remove __typename-only fragment (without @client) when fragment precedes query", () => {
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

test("should not remove fragment referenced by fragment used by operation", () => {
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

test("should remove __typename only fragment after @client removal", () => {
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

test("should keep moreAuthorInfo fragment if used elsewhere", () => {
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

test("should remove unused variables in nested fragments", () => {
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

test("should not remove variables used in unremoved parts of query", () => {
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
