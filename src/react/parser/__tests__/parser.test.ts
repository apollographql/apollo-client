import gql from "graphql-tag";

import { parser, DocumentType } from "..";

type OperationDefinition = any;

describe("parser", () => {
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

    expect(parser.bind(null, query)).toThrowError(/react-apollo only supports/);
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

    expect(parser.bind(null, query)).toThrowError(/react-apollo only supports/);
  });

  it("should error if not a DocumentNode", () => {
    const query = `
      query One { user { name } }
    `;
    expect(parser.bind(null, query as any)).toThrowError(
      /not a valid GraphQL DocumentNode/
    );
  });

  it("should return the name of the operation", () => {
    const query = gql`
      query One {
        user {
          name
        }
      }
    `;
    expect(parser(query).name).toBe("One");

    const mutation = gql`
      mutation One {
        user {
          name
        }
      }
    `;
    expect(parser(mutation).name).toBe("One");

    const subscription = gql`
      subscription One {
        user {
          name
        }
      }
    `;
    expect(parser(subscription).name).toBe("One");
  });

  it("should return data as the name of the operation if not named", () => {
    const query = gql`
      query {
        user {
          name
        }
      }
    `;
    expect(parser(query).name).toBe("data");

    const unnamedQuery = gql`
      {
        user {
          name
        }
      }
    `;
    expect(parser(unnamedQuery).name).toBe("data");

    const mutation = gql`
      mutation {
        user {
          name
        }
      }
    `;
    expect(parser(mutation).name).toBe("data");

    const subscription = gql`
      subscription {
        user {
          name
        }
      }
    `;
    expect(parser(subscription).name).toBe("data");
  });

  it("should return the type of operation", () => {
    const query = gql`
      query One {
        user {
          name
        }
      }
    `;
    expect(parser(query).type).toBe(DocumentType.Query);

    const unnamedQuery = gql`
      {
        user {
          name
        }
      }
    `;
    expect(parser(unnamedQuery).type).toBe(DocumentType.Query);

    const mutation = gql`
      mutation One {
        user {
          name
        }
      }
    `;
    expect(parser(mutation).type).toBe(DocumentType.Mutation);

    const subscription = gql`
      subscription One {
        user {
          name
        }
      }
    `;
    expect(parser(subscription).type).toBe(DocumentType.Subscription);
  });

  it("should return the variable definitions of the operation", () => {
    const query = gql`
      query One($t: String!) {
        user(t: $t) {
          name
        }
      }
    `;
    let definition = query.definitions[0] as OperationDefinition;
    expect(parser(query).variables).toEqual(definition.variableDefinitions);

    const mutation = gql`
      mutation One($t: String!) {
        user(t: $t) {
          name
        }
      }
    `;
    definition = mutation.definitions[0] as OperationDefinition;
    expect(parser(mutation).variables).toEqual(definition.variableDefinitions);

    const subscription = gql`
      subscription One($t: String!) {
        user(t: $t) {
          name
        }
      }
    `;
    definition = subscription.definitions[0] as OperationDefinition;
    expect(parser(subscription).variables).toEqual(
      definition.variableDefinitions
    );
  });

  it("should not error if the operation has no variables", () => {
    const query = gql`
      query {
        user(t: $t) {
          name
        }
      }
    `;
    let definition = query.definitions[0] as OperationDefinition;
    expect(parser(query).variables).toEqual(definition.variableDefinitions);

    const mutation = gql`
      mutation {
        user(t: $t) {
          name
        }
      }
    `;
    definition = mutation.definitions[0] as OperationDefinition;
    expect(parser(mutation).variables).toEqual(definition.variableDefinitions);

    const subscription = gql`
      subscription {
        user(t: $t) {
          name
        }
      }
    `;
    definition = subscription.definitions[0] as OperationDefinition;
    expect(parser(subscription).variables).toEqual(
      definition.variableDefinitions
    );
  });
});
