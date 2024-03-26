// Originally from @graphql-tools/mock
// https://github.com/ardatan/graphql-tools/blob/4b56b04d69b02919f6c5fa4f97d33da63f36e8c8/packages/mock/tests/addMocksToSchema.spec.ts

import { buildSchema, graphql } from "graphql";
import { createMockSchema } from "./utils.js";

const mockDate = new Date().toJSON().split("T")[0];

const mocks = {
  Int: () => 6,
  Float: () => 22.1,
  String: () => "string",
  ID: () => "id",
  Date: () => mockDate,
};

const typeDefs = /* GraphQL */ `
  type User {
    id: ID!
    age: Int!
    name: String!
    image: UserImage!
    book: Book!
  }

  type Author {
    _id: ID!
    name: String!
    book: Book!
  }

  union UserImage = UserImageSolidColor | UserImageURL

  type UserImageSolidColor {
    color: String!
  }

  type UserImageURL {
    url: String!
  }

  scalar Date

  interface Book {
    id: ID!
    title: String
    publishedAt: Date
  }

  type TextBook implements Book {
    id: ID!
    title: String
    publishedAt: Date
    text: String
  }

  type ColoringBook implements Book {
    id: ID!
    title: String
    publishedAt: Date
    colors: [String]
  }

  type Query {
    viewer: User!
    userById(id: ID!): User!
    author: Author!
  }

  type Mutation {
    changeViewerName(newName: String!): User!
  }
`;

const schema = buildSchema(typeDefs);

describe("addMocksToSchema", () => {
  it("basic", async () => {
    const query = /* GraphQL */ `
      query {
        viewer {
          id
          name
          age
        }
      }
    `;

    const mockedSchema = createMockSchema(schema, mocks);

    const { data, errors } = await graphql({
      schema: mockedSchema,
      source: query,
    });

    expect(errors).not.toBeDefined();
    expect(data).toBeDefined();

    const viewerData = data?.["viewer"] as any;
    expect(typeof viewerData["id"]).toBe("string");
    expect(typeof viewerData["name"]).toBe("string");
    expect(typeof viewerData["age"]).toBe("number");

    const { data: data2 } = await graphql({
      schema: mockedSchema,
      source: query,
    });

    const viewerData2 = data2?.["viewer"] as any;

    expect(viewerData2["id"]).toEqual(viewerData["id"]);
  });

  it("handle _id key field", async () => {
    const query = /* GraphQL */ `
      query {
        author {
          _id
          name
        }
      }
    `;
    const mockedSchema = createMockSchema(schema, mocks);
    const { data, errors } = await graphql({
      schema: mockedSchema,
      source: query,
    });

    expect(errors).not.toBeDefined();
    expect(data).toBeDefined();
    const viewerData = data?.["author"] as any;
    expect(typeof viewerData["_id"]).toBe("string");
    expect(typeof viewerData["name"]).toBe("string");

    const { data: data2 } = await graphql({
      schema: mockedSchema,
      source: query,
    });

    const viewerData2 = data2?.["author"] as any;

    expect(viewerData2["_id"]).toEqual(viewerData["_id"]);
  });

  it("should handle union type", async () => {
    const query = /* GraphQL */ `
      query {
        viewer {
          image {
            __typename
            ... on UserImageURL {
              url
            }
            ... on UserImageSolidColor {
              color
            }
          }
        }
      }
    `;

    const mockedSchema = createMockSchema(schema, mocks);

    const { data, errors } = await graphql({
      schema: mockedSchema,
      source: query,
    });

    expect(errors).not.toBeDefined();
    expect(data).toBeDefined();
    expect((data!["viewer"] as any)["image"]["__typename"]).toBeDefined();
  });

  it("should handle interface type", async () => {
    const query = /* GraphQL */ `
      query {
        viewer {
          book {
            title
            __typename
            ... on TextBook {
              text
            }
            ... on ColoringBook {
              colors
            }
          }
        }
      }
    `;

    const mockedSchema = createMockSchema(schema, mocks);

    const { data, errors } = await graphql({
      schema: mockedSchema,
      source: query,
    });

    expect(errors).not.toBeDefined();
    expect(data).toBeDefined();
    expect((data!["viewer"] as any)["book"]["__typename"]).toBeDefined();
  });

  it("should handle custom scalars", async () => {
    const query = /* GraphQL */ `
      query {
        viewer {
          book {
            title
            publishedAt
          }
        }
      }
    `;

    const mockedSchema = createMockSchema(schema, mocks);

    const { data, errors } = await graphql({
      schema: mockedSchema,
      source: query,
    });

    expect(errors).not.toBeDefined();
    expect(data).toBeDefined();
    expect((data!["viewer"] as any)["book"]["publishedAt"]).toBe(mockDate);
  });
});
