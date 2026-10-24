import { gql } from "@apollo/client";
import { addTypenameToDocument } from "@apollo/client/utilities";
import { removeDirectivesFromDocument } from "@apollo/client/utilities/internal";

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
