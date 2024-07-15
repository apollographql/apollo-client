import React from "react";
import { act, render } from "@testing-library/react";
import gql from "graphql-tag";
import { DocumentNode } from "graphql";

import { ApolloClient } from "../../../../core";
import { ApolloProvider } from "../../../context";
import { InMemoryCache as Cache } from "../../../../cache";
import { ApolloLink } from "../../../../link/core";
import { itAsync, MockSubscriptionLink } from "../../../../testing";
import { graphql } from "../../graphql";
import { ChildProps } from "../../types";

describe("subscriptions", () => {
  let error: typeof console.error;

  beforeEach(() => {
    jest.useRealTimers();
    error = console.error;
    console.error = jest.fn(() => {});
  });

  afterEach(() => {
    console.error = error;
  });

  const results = [
    "James Baxley",
    "John Pinkerton",
    "Sam Claridge",
    "Ben Coleman",
  ].map((name) => ({
    result: { data: { user: { name } } },
    delay: 10,
  }));

  it("binds a subscription to props", () => {
    const query: DocumentNode = gql`
      subscription UserInfo {
        user {
          name
        }
      }
    `;
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    interface Props {}
    interface Data {
      user: { name: string };
    }

    const ContainerWithData = graphql<Props, Data>(query)(({
      data,
    }: ChildProps<Props, Data>) => {
      expect(data).toBeTruthy();
      expect(data!.user).toBeFalsy();
      expect(data!.loading).toBeTruthy();
      return null;
    });

    render(
      <ApolloProvider client={client}>
        <ContainerWithData />
      </ApolloProvider>
    );
  });

  it("includes the variables in the props", () => {
    const query: DocumentNode = gql`
      subscription UserInfo($name: String) {
        user(name: $name) {
          name
        }
      }
    `;
    const variables = { name: "James Baxley" };
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    interface Variables {
      name: string;
    }

    interface Data {
      user: { name: string };
    }

    const ContainerWithData = graphql<Variables, Data>(query)(({
      data,
    }: ChildProps<Variables, Data>) => {
      expect(data).toBeTruthy();
      expect(data!.variables).toEqual(variables);
      return null;
    });

    render(
      <ApolloProvider client={client}>
        <ContainerWithData name={"James Baxley"} />
      </ApolloProvider>
    );
  });

  itAsync("does not swallow children errors", (resolve, reject) => {
    const query: DocumentNode = gql`
      subscription UserInfo {
        user {
          name
        }
      }
    `;
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    let bar: any;
    const ContainerWithData = graphql(query)(() => {
      bar(); // this will throw
      return null;
    });

    class ErrorBoundary extends React.Component<React.PropsWithChildren> {
      componentDidCatch(e: any) {
        expect(e.name).toMatch(/TypeError/);
        expect(e.message).toMatch(/bar is not a function/);
        resolve();
      }

      render() {
        // eslint-disable-next-line testing-library/no-node-access
        return this.props.children;
      }
    }

    render(
      <ApolloProvider client={client}>
        <ErrorBoundary>
          <ContainerWithData />
        </ErrorBoundary>
      </ApolloProvider>
    );
  });

  itAsync("executes a subscription", (resolve, reject) => {
    jest.useFakeTimers();

    const query: DocumentNode = gql`
      subscription UserInfo {
        user {
          name
        }
      }
    `;

    interface Data {
      user: { name: string };
    }
    const link = new MockSubscriptionLink();
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    let count = 0;
    const Container = graphql<{}, Data>(query)(
      class Query extends React.Component<ChildProps<{}, Data>> {
        render() {
          const { loading, user } = this.props.data!;
          switch (count) {
            case 0:
              expect(loading).toBeTruthy();
              resolve();
              break;
            case 1:
              expect(loading).toBeFalsy();
              expect(user).toEqual(results[0].result.data.user);
              break;
            case 2:
              expect(loading).toBeFalsy();
              expect(user).toEqual(results[1].result.data.user);
              break;
            case 3:
              expect(loading).toBeFalsy();
              expect(user).toEqual(results[2].result.data.user);
              break;
            case 4:
              expect(loading).toBeFalsy();
              expect(user).toEqual(results[3].result.data.user);
              break;
            default:
          }
          count += 1;
          return null;
        }
      }
    );

    const interval = setInterval(() => {
      link.simulateResult(results[count - 1]);
      if (count - 1 > 3) clearInterval(interval);
    }, 50);

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );

    act(() => {
      jest.advanceTimersByTime(230);
    });
  });

  itAsync("resubscribes to a subscription", (resolve, reject) => {
    //we make an extra Hoc which will trigger the inner HoC to resubscribe
    //these are the results for the outer subscription
    const triggerResults = [
      "0",
      "trigger resubscribe",
      "3",
      "4",
      "5",
      "6",
      "7",
    ].map((trigger) => ({
      result: { data: { trigger } },
      delay: 10,
    }));

    //These are the results from the resubscription
    const results3 = [
      "NewUser: 1",
      "NewUser: 2",
      "NewUser: 3",
      "NewUser: 4",
    ].map((name) => ({
      result: { data: { user: { name } } },
      delay: 10,
    }));

    const query: DocumentNode = gql`
      subscription UserInfo {
        user {
          name
        }
      }
    `;
    interface QueryData {
      user: { name: string };
    }

    const triggerQuery: DocumentNode = gql`
      subscription Trigger {
        trigger
      }
    `;
    interface TriggerData {
      trigger: string;
    }

    const userLink = new MockSubscriptionLink();
    const triggerLink = new MockSubscriptionLink();
    const link = new ApolloLink((o, f) => (f ? f(o) : null)).split(
      ({ operationName }) => operationName === "UserInfo",
      userLink,
      triggerLink
    );

    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    let count = 0;

    type TriggerQueryChildProps = ChildProps<{}, TriggerData>;
    type ComposedProps = ChildProps<TriggerQueryChildProps, QueryData>;

    const Container = graphql<{}, TriggerData>(triggerQuery)(
      graphql<TriggerQueryChildProps, QueryData>(query, {
        shouldResubscribe: (nextProps) => {
          return nextProps.data!.trigger === "trigger resubscribe";
        },
      })(
        class Query extends React.Component<ComposedProps> {
          componentDidUpdate() {
            const { loading, user } = this.props.data!;
            try {
              // odd counts will be outer wrapper getting subscriptions - ie unchanged
              expect(loading).toBeFalsy();
              if (count === 0)
                expect(user).toEqual(results[0].result.data.user);
              if (count === 1) {
                expect(user).toEqual(results[0].result.data.user);
              }
              if (count === 2)
                expect(user).toEqual(results[2].result.data.user);
              if (count === 3)
                expect(user).toEqual(results[2].result.data.user);
              if (count === 4) {
                expect(user).toEqual(results3[2].result.data.user);
              }
              if (count === 5) {
                expect(user).toEqual(results3[2].result.data.user);
                resolve();
              }
            } catch (e) {
              reject(e);
            }

            count++;
          }
          render() {
            return null;
          }
        }
      )
    );

    const interval = setInterval(() => {
      try {
        if (count > 2) {
          userLink.simulateResult(results3[count - 2]);
        } else {
          userLink.simulateResult(results[count]);
        }

        triggerLink.simulateResult(triggerResults[count]);
      } catch (ex) {
        clearInterval(interval);
      }
      if (count > 3) clearInterval(interval);
    }, 50);

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );
  });
});
