import { ApolloError } from "..";

describe("ApolloError", () => {
  it("should construct itself correctly", () => {
    const graphQLErrors = [
      { message: "Something went wrong with GraphQL" },
      { message: "Something else went wrong with GraphQL" },
    ];
    const protocolErrors = [
      {
        message: "cannot read message from websocket",
        extensions: [
          {
            code: "WEBSOCKET_MESSAGE_ERROR",
          },
        ],
      },
    ];
    const networkError = new Error("Network error");
    const errorMessage = "this is an error message";
    const apolloError = new ApolloError({
      graphQLErrors: graphQLErrors,
      protocolErrors: protocolErrors,
      networkError: networkError,
      errorMessage: errorMessage,
    });
    expect(apolloError.graphQLErrors).toEqual(graphQLErrors);
    expect(apolloError.protocolErrors).toEqual(protocolErrors);
    expect(apolloError.networkError).toEqual(networkError);
    expect(apolloError.message).toBe(errorMessage);
  });

  it("should add a network error to the message", () => {
    const networkError = new Error("this is an error message");
    const apolloError = new ApolloError({
      networkError,
    });
    expect(apolloError.message).toMatch("this is an error message");
    expect(apolloError.message.split("\n").length).toBe(1);
  });

  it("should add a graphql error to the message", () => {
    const graphQLErrors = [{ message: "this is an error message" }];
    const apolloError = new ApolloError({
      graphQLErrors,
    });
    expect(apolloError.message).toMatch("this is an error message");
    expect(apolloError.message.split("\n").length).toBe(1);
  });

  it("should add multiple graphql errors to the message", () => {
    const graphQLErrors = [
      { message: "this is new" },
      { message: "this is old" },
    ];
    const apolloError = new ApolloError({
      graphQLErrors,
    });
    const messages = apolloError.message.split("\n");
    expect(messages.length).toBe(2);
    expect(messages[0]).toMatch("this is new");
    expect(messages[1]).toMatch("this is old");
  });

  it("should add both network and graphql errors to the message", () => {
    const graphQLErrors = [{ message: "graphql error message" }];
    const networkError = new Error("network error message");
    const apolloError = new ApolloError({
      graphQLErrors,
      networkError,
    });
    const messages = apolloError.message.split("\n");
    expect(messages.length).toBe(2);
    expect(messages[0]).toMatch("graphql error message");
    expect(messages[1]).toMatch("network error message");
  });

  it("should add both protocol and graphql errors to the message", () => {
    const graphQLErrors = [{ message: "graphql error message" }];
    const protocolErrors = [
      {
        message: "cannot read message from websocket",
        extensions: [
          {
            code: "WEBSOCKET_MESSAGE_ERROR",
          },
        ],
      },
    ];
    const apolloError = new ApolloError({
      graphQLErrors,
      protocolErrors,
    });
    const messages = apolloError.message.split("\n");
    expect(messages.length).toBe(2);
    expect(messages[0]).toMatch("graphql error message");
    expect(messages[1]).toMatch("cannot read message from websocket");
  });

  it("should contain a stack trace", () => {
    const graphQLErrors = [{ message: "graphql error message" }];
    const networkError = new Error("network error message");
    const apolloError = new ApolloError({
      graphQLErrors,
      networkError,
    });
    expect(apolloError.stack).toBeDefined();
  });
});
