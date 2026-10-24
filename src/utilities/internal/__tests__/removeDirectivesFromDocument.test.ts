import { versionInfo } from "graphql";

import { enableExperimentalFragmentVariables, gql } from "@apollo/client";
import { addTypenameToDocument } from "@apollo/client/utilities";
import { removeDirectivesFromDocument } from "@apollo/client/utilities/internal";

enableExperimentalFragmentVariables();

// Fragment arguments can only be parsed with GraphQL 17 or later.
const testWithFragmentArgs = versionInfo.major >= 17 ? test : test.skip;

test("should remove inline fragments using a directive", () => {
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

test("should not remove unused variable definitions unless the field is removed", () => {
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

test("should remove unused variable definitions associated with the removed directive", () => {
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

test("should not remove used variable definitions", () => {
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

test("should remove fragment spreads and definitions associated with the removed directive", () => {
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

test("should not remove fragment spreads and definitions used without the removed directive", () => {
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

test("should remove a simple directive", () => {
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

test("should remove a simple directive [test function]", () => {
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

test("should remove only the wanted directive", () => {
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

test("should remove only the wanted directive [test function]", () => {
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

test("should remove multiple directives in the query", () => {
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

test("should remove multiple directives of different kinds in the query", () => {
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

test("should remove a simple directive and its field if needed", () => {
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

test("should remove a simple directive [test function]", () => {
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

test("should return null if the query is no longer valid", () => {
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

test("should return null if the query is no longer valid [test function]", () => {
  const query = gql`
    query Simple {
      field @storage(if: true)
    }
  `;

  const test = ({ name: { value } }: { name: any }) => value === "storage";
  const doc = removeDirectivesFromDocument([{ test, remove: true }], query);

  expect(doc).toBe(null);
});

test("should not return null if nothing was removed", () => {
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

test("should return null only if the query is not valid through nested fragments", () => {
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

test("should only remove values asked through nested fragments", () => {
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

test("should return null even through fragments if needed", () => {
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

test("should not throw in combination with addTypenameToDocument", () => {
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

testWithFragmentArgs(
  "should remove unused fragment variable definitions and spread arguments associated with the removed directive",
  () => {
    const query = gql`
    query Team {
      lead {
        ...UserCard(size: 96)
      }
    }

    fragment UserCard($size: Int) on User {
      id
      localAvatar(size: $size) @client
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Team {
        lead {
          ...UserCard
        }
      }

      fragment UserCard on User {
        id
      }
    `);
  }
);

testWithFragmentArgs(
  "should remove operation variables that were only used by a removed spread argument",
  () => {
    const query = gql`
    query Team($n: Int) {
      lead {
        ...UserCard(size: $n)
      }
    }

    fragment UserCard($size: Int) on User {
      id
      localAvatar(size: $size) @client
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Team {
        lead {
          ...UserCard
        }
      }

      fragment UserCard on User {
        id
      }
    `);
  }
);

testWithFragmentArgs(
  "should not remove used fragment variable definitions",
  () => {
    const query = gql`
    query Team {
      lead {
        ...UserCard(size: 96)
      }
    }

    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
      localAvatar(size: $size) @client
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
    query Team {
      lead {
        ...UserCard(size: 96)
      }
    }

    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `);
  }
);

testWithFragmentArgs(
  "should remove only the spread arguments and variables that are no longer used",
  () => {
    const query = gql`
    query Team($n: Int, $f: String) {
      lead {
        ...UserCard(size: $n, format: $f)
      }
    }

    fragment UserCard($size: Int, $format: String) on User {
      id
      avatar(size: $size)
      localAvatar(format: $format) @client
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
    query Team($n: Int) {
      lead {
        ...UserCard(size: $n)
      }
    }

    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `);
  }
);

testWithFragmentArgs(
  "should remove operation variables that were only used in a removed object spread argument",
  () => {
    const query = gql`
    query Team($width: Int, $height: Int) {
      lead {
        ...UserCard(dimensions: { width: $width, height: $height })
      }
    }

    fragment UserCard($dimensions: Dimensions) on User {
      id
      localAvatar(dimensions: $dimensions) @client
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Team {
        lead {
          ...UserCard
        }
      }

      fragment UserCard on User {
        id
      }
    `);
  }
);

testWithFragmentArgs(
  "should remove operation variables that were only used in a removed list spread argument",
  () => {
    const query = gql`
    query Team($first: String, $second: String) {
      lead {
        ...UserCard(tags: [$first, $second])
      }
    }

    fragment UserCard($tags: [String]) on User {
      id
      localAvatar(tags: $tags) @client
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Team {
        lead {
          ...UserCard
        }
      }

      fragment UserCard on User {
        id
      }
    `);
  }
);

testWithFragmentArgs(
  "should remove variables passed through several nested spreads when the last fragment no longer uses them",
  () => {
    const query = gql`
    query Team($n: Int) {
      lead {
        ...Outer(size: $n)
      }
    }

    fragment Outer($size: Int) on User {
      ...Middle(size: $size)
    }

    fragment Middle($size: Int) on User {
      ...Inner(size: $size)
    }

    fragment Inner($size: Int) on User {
      id
      localAvatar(size: $size) @client
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Team {
        lead {
          ...Outer
        }
      }

      fragment Outer on User {
        ...Middle
      }

      fragment Middle on User {
        ...Inner
      }

      fragment Inner on User {
        id
      }
    `);
  }
);

testWithFragmentArgs(
  "should not remove variables passed through several nested spreads when the last fragment still uses them",
  () => {
    const query = gql`
    query Team($n: Int) {
      lead {
        ...Outer(size: $n)
      }
    }

    fragment Outer($size: Int) on User {
      ...Middle(size: $size)
    }

    fragment Middle($size: Int) on User {
      ...Inner(size: $size)
    }

    fragment Inner($size: Int) on User {
      id
      avatar(size: $size)
      localAvatar(size: $size) @client
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
    query Team($n: Int) {
      lead {
        ...Outer(size: $n)
      }
    }

    fragment Outer($size: Int) on User {
      ...Middle(size: $size)
    }

    fragment Middle($size: Int) on User {
      ...Inner(size: $size)
    }

    fragment Inner($size: Int) on User {
      id
      avatar(size: $size)
    }
  `);
  }
);

testWithFragmentArgs(
  "should only remove variables from the nested spread levels that no longer use them",
  () => {
    const query = gql`
    query Team($n: Int, $f: String) {
      lead {
        ...Outer(size: $n, format: $f)
      }
    }

    fragment Outer($size: Int, $format: String) on User {
      avatar(size: $size)
      ...Inner(format: $format)
    }

    fragment Inner($format: String) on User {
      id
      localAvatar(format: $format) @client
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
    query Team($n: Int) {
      lead {
        ...Outer(size: $n)
      }
    }

    fragment Outer($size: Int) on User {
      avatar(size: $size)
      ...Inner
    }

    fragment Inner on User {
      id
    }
  `);
  }
);

testWithFragmentArgs(
  "should keep an operation variable that another spread still uses",
  () => {
    const query = gql`
    query Team($n: Int) {
      lead {
        ...LocalCard(size: $n)
        ...AvatarCard(size: $n)
      }
    }

    fragment LocalCard($size: Int) on User {
      id
      localAvatar(size: $size) @client
    }

    fragment AvatarCard($size: Int) on User {
      avatar(size: $size)
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
    query Team($n: Int) {
      lead {
        ...LocalCard
        ...AvatarCard(size: $n)
      }
    }

    fragment LocalCard on User {
      id
    }

    fragment AvatarCard($size: Int) on User {
      avatar(size: $size)
    }
  `);
  }
);

testWithFragmentArgs(
  "should not treat a child fragment's operation variable as a parent fragment variable with the same name",
  () => {
    const query = gql`
    query Team($size: Int, $n: Int) {
      lead {
        ...Parent(size: $n)
      }
    }

    fragment Parent($size: Int) on User {
      localAvatar(size: $size) @client
      ...Child
    }

    fragment Child on User {
      avatar(size: $size)
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Team($size: Int) {
        lead {
          ...Parent
        }
      }

      fragment Parent on User {
        ...Child
      }

      fragment Child on User {
        avatar(size: $size)
      }
    `);
  }
);

testWithFragmentArgs(
  "should only count child spread arguments that use the fragment variable",
  () => {
    const query = gql`
    query Team($n: Int, $f: String) {
      lead {
        ...Parent(size: $n, format: $f)
      }
    }

    fragment Parent($size: Int, $format: String) on User {
      localAvatar(size: $size) @client
      ...Child(format: $format)
    }

    fragment Child($format: String) on User {
      avatar(format: $format)
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
    query Team($f: String) {
      lead {
        ...Parent(format: $f)
      }
    }

    fragment Parent($format: String) on User {
      ...Child(format: $format)
    }

    fragment Child($format: String) on User {
      avatar(format: $format)
    }
  `);
  }
);

testWithFragmentArgs(
  "should keep an operation variable used by a child fragment when the parent fragment declares a variable with the same name",
  () => {
    const query = gql`
    query Team($size: Int, $n: Int) {
      lead {
        ...Parent(size: $n)
      }
    }

    fragment Parent($size: Int) on User {
      photo(size: $size)
      ...Child
    }

    fragment Child on User {
      avatar(size: $size)
      localAvatar @client
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
    query Team($size: Int, $n: Int) {
      lead {
        ...Parent(size: $n)
      }
    }

    fragment Parent($size: Int) on User {
      photo(size: $size)
      ...Child
    }

    fragment Child on User {
      avatar(size: $size)
    }
  `);
  }
);

testWithFragmentArgs(
  "should keep variables used by directives on a spread when its arguments are removed",
  () => {
    const query = gql`
    query Team($n: Int, $show: Boolean!) {
      lead {
        ...UserCard(size: $n) @include(if: $show)
      }
    }

    fragment UserCard($size: Int) on User {
      id
      localAvatar(size: $size) @client
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Team($show: Boolean!) {
        lead {
          ...UserCard @include(if: $show)
        }
      }

      fragment UserCard on User {
        id
      }
    `);
  }
);

testWithFragmentArgs(
  "should remove operation variables used by the arguments of a removed spread",
  () => {
    const query = gql`
    query Team($n: Int) {
      lead {
        id
        ...UserCard(size: $n) @client
      }
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Team {
        lead {
          id
        }
      }
    `);
  }
);

testWithFragmentArgs(
  "should remove operation variables used by the arguments of a spread to a fragment that is removed",
  () => {
    const query = gql`
    query Team($n: Int) {
      lead {
        id
        ...UserCard(size: $n)
      }
    }

    fragment UserCard($size: Int) on User {
      __typename
      localAvatar(size: $size) @client
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Team {
        lead {
          id
        }
      }
    `);
  }
);

testWithFragmentArgs(
  "should remove fragment variables only used in a removed inline fragment",
  () => {
    const query = gql`
    query Team($n: Int) {
      lead {
        ...UserCard(size: $n)
      }
    }

    fragment UserCard($size: Int) on User {
      id
      ... on User @client {
        localAvatar(size: $size)
      }
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Team {
        lead {
          ...UserCard
        }
      }

      fragment UserCard on User {
        id
      }
    `);
  }
);

testWithFragmentArgs(
  "should not throw for cyclic fragment spreads with arguments",
  () => {
    const query = gql`
    query Team($n: Int) {
      lead {
        ...A(x: $n)
      }
    }

    fragment A($x: Int) on User {
      id
      ...B(y: $x)
    }

    fragment B($y: Int) on User {
      localAvatar(size: $y) @client
      ...A(x: $y)
    }
  `;

    const doc = removeDirectivesFromDocument(
      [{ name: "client", remove: true }],
      query
    );

    expect(doc).toMatchDocument(gql`
      query Team {
        lead {
          ...A
        }
      }

      fragment A on User {
        id
        ...B
      }

      fragment B on User {
        ...A
      }
    `);
  }
);
