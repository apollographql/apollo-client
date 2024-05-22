/** @jest-environment node */
import React from "react";
import PropTypes from "prop-types";
import ReactDOM from "react-dom/server";
import gql from "graphql-tag";
import { DocumentNode } from "graphql";

import { ApolloClient } from "../../../../core";
import { ApolloProvider } from "../../../context";
import { InMemoryCache as Cache } from "../../../../cache";
import { itAsync, mockSingleLink } from "../../../../testing";
import { Query } from "../../../components";
import { getDataFromTree, getMarkupFromTree } from "../../../ssr";
import { graphql } from "../../graphql";
import { ChildProps, DataValue } from "../../types";

describe("SSR", () => {
  describe("`getDataFromTree`", () => {
    const consoleWarn = console.warn;
    beforeAll(() => {
      console.warn = () => null;
    });

    afterAll(() => {
      console.warn = consoleWarn;
    });

    it("should run through all of the queries that want SSR", async () => {
      const query = gql`
        {
          currentUser {
            firstName
          }
        }
      `;
      const data1 = { currentUser: { firstName: "James" } };
      const link = mockSingleLink({
        request: { query },
        result: { data: data1 },
      });
      const apolloClient = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      interface Props {}
      interface Data {
        currentUser: {
          firstName: string;
        };
      }
      const WrappedElement = graphql<Props, Data>(query)(
        ({ data }: ChildProps<Props, Data>) => (
          <div>
            {!data || data.loading || !data.currentUser ?
              "loading"
            : data.currentUser.firstName}
          </div>
        )
      );

      const app = (
        <ApolloProvider client={apolloClient}>
          <WrappedElement />
        </ApolloProvider>
      );

      await getDataFromTree(app).then((markup) => {
        expect(markup).toMatch(/James/);
      });

      await getMarkupFromTree({
        tree: app,
        renderFunction: ReactDOM.renderToString,
      }).then((markup) => {
        expect(markup).toMatch(/James/);
      });
    });

    it("should allow network-only fetchPolicy as an option and still render prefetched data", () => {
      const query = gql`
        {
          currentUser {
            firstName
          }
        }
      `;
      const link = mockSingleLink({
        request: { query },
        result: { data: { currentUser: { firstName: "James" } } },
      });
      const apolloClient = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
        ssrMode: true,
      });

      interface Props {}
      interface Data {
        currentUser: {
          firstName: string;
        };
      }
      const WrappedElement = graphql<Props, Data>(query, {
        options: { fetchPolicy: "network-only" },
      })(({ data }: ChildProps<Props, Data>) => (
        <div>
          {!data || data.loading || !data.currentUser ?
            "loading"
          : data.currentUser.firstName}
        </div>
      ));

      const app = (
        <ApolloProvider client={apolloClient}>
          <WrappedElement />
        </ApolloProvider>
      );

      return getDataFromTree(app).then((markup) => {
        expect(markup).toMatch(/James/);
      });
    });

    it("should allow cache-and-network fetchPolicy as an option and still render prefetched data", () => {
      const query = gql`
        {
          currentUser {
            firstName
          }
        }
      `;
      const link = mockSingleLink({
        request: { query },
        result: { data: { currentUser: { firstName: "James" } } },
      });
      const apolloClient = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      interface Props {}
      interface Data {
        currentUser: {
          firstName: string;
        };
      }
      const WrappedElement = graphql<Props, Data>(query, {
        options: { fetchPolicy: "cache-and-network" },
      })(({ data }: ChildProps<Props, Data>) => (
        <div>
          {data && data.currentUser ? data.currentUser.firstName : "loading"}
        </div>
      ));

      const app = (
        <ApolloProvider client={apolloClient}>
          <WrappedElement />
        </ApolloProvider>
      );

      return getDataFromTree(app).then((markup) => {
        expect(markup).toMatch(/James/);
      });
    });

    it("should pick up queries deep in the render tree", () => {
      const query = gql`
        {
          currentUser {
            firstName
          }
        }
      `;
      const link = mockSingleLink({
        request: { query },
        result: { data: { currentUser: { firstName: "James" } } },
      });
      const apolloClient = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      interface Props {}
      interface Data {
        currentUser: {
          firstName: string;
        };
      }

      const WrappedElement = graphql<Props, Data>(query)(
        ({ data }: ChildProps<Props, Data>) => (
          <div>
            {!data || data.loading || !data.currentUser ?
              "loading"
            : data.currentUser.firstName}
          </div>
        )
      );

      const Page = () => (
        <div>
          <span>Hi</span>
          <div>
            <WrappedElement />
          </div>
        </div>
      );

      const app = (
        <ApolloProvider client={apolloClient}>
          <Page />
        </ApolloProvider>
      );

      return getDataFromTree(app).then((markup) => {
        expect(markup).toMatch(/James/);
      });
    });

    it("should handle nested queries that depend on each other", () => {
      const idQuery: DocumentNode = gql`
        {
          currentUser {
            id
          }
        }
      `;
      const idData = { currentUser: { id: "1234" } };
      const userQuery: DocumentNode = gql`
        query getUser($id: String) {
          user(id: $id) {
            firstName
          }
        }
      `;
      const variables = { id: "1234" };
      const userData = { user: { firstName: "James" } };
      const link = mockSingleLink(
        { request: { query: idQuery }, result: { data: idData } },
        {
          request: { query: userQuery, variables },
          result: { data: userData },
        }
      );
      const apolloClient = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      interface Props {}
      interface IdQueryData {
        currentUser: {
          id: string;
        };
      }

      interface UserQueryData {
        user: {
          firstName: string;
        };
      }

      interface UserQueryVariables {
        id: string;
      }

      type WithIdChildProps = ChildProps<Props, IdQueryData>;
      const withId = graphql<Props, IdQueryData>(idQuery);

      const withUser = graphql<
        WithIdChildProps,
        UserQueryData,
        UserQueryVariables
      >(userQuery, {
        skip: ({ data }) => data!.loading,
        options: ({ data }) => ({
          variables: { id: data!.currentUser!.id },
        }),
      });
      const Component: React.FunctionComponent<
        React.PropsWithChildren<React.PropsWithChildren<any>>
      > = ({ data }) => (
        <div>
          {!data || data.loading || !data.user ?
            "loading"
          : data.user.firstName}
        </div>
      );

      const WrappedComponent = withId(withUser(Component));

      const app = (
        <ApolloProvider client={apolloClient}>
          <WrappedComponent />
        </ApolloProvider>
      );

      return getDataFromTree(app).then((markup) => {
        expect(markup).toMatch(/James/);
      });
    });

    it.skip("should return the first of multiple errors thrown by nested wrapped components", () => {
      const lastNameQuery = gql`
        {
          currentUser {
            lastName
          }
        }
      `;
      interface LastNameData {
        currentUser: {
          lastName: string;
        };
      }
      const firstNameQuery = gql`
        {
          currentUser {
            firstName
          }
        }
      `;

      const link = mockSingleLink(
        {
          request: { query: lastNameQuery },
          result: {
            data: {
              currentUser: {
                lastName: "Tester",
              },
            },
          },
        },
        {
          request: { query: firstNameQuery },
          result: {
            data: {
              currentUser: {
                firstName: "James",
              },
            },
          },
        }
      );
      const apolloClient = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      interface Props {}

      type WithLastNameProps = ChildProps<Props, LastNameData>;
      const withLastName = graphql<Props, LastNameData>(lastNameQuery);

      const fooError = new Error("foo");
      const BorkedComponent = () => {
        throw fooError;
      };

      const WrappedBorkedComponent = withLastName(BorkedComponent);

      const ContainerComponent: React.FunctionComponent<
        React.PropsWithChildren<React.PropsWithChildren<WithLastNameProps>>
      > = ({ data }) => (
        <div>
          {!data || data.loading || !data.currentUser ?
            "loading"
          : data.currentUser.lastName}
          <WrappedBorkedComponent />
          <WrappedBorkedComponent />
        </div>
      );

      const withFirstName = graphql<Props, any>(firstNameQuery);

      const WrappedContainerComponent = withFirstName(ContainerComponent);

      const app = (
        <ApolloProvider client={apolloClient}>
          <WrappedContainerComponent />
        </ApolloProvider>
      );

      return getDataFromTree(app).then(
        () => {
          throw new Error("Should have thrown an error");
        },
        (e) => {
          expect(e.toString()).toEqual("Error: foo");
          expect(e).toBe(fooError);
        }
      );
    });

    it("should handle errors thrown by queries", () => {
      const query = gql`
        {
          currentUser {
            firstName
          }
        }
      `;
      const link = mockSingleLink({
        request: { query },
        error: new Error("Failed to fetch"),
      });
      const apolloClient = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      interface Props {}
      interface Data {
        currentUser: {
          firstName: string;
        };
      }
      const WrappedElement = graphql<Props, Data>(query)(
        ({ data }: ChildProps<Props, Data>) => (
          <div>
            {!data || data.loading ? "loading" : data.error?.toString()}
          </div>
        )
      );

      const Page = () => (
        <div>
          <span>Hi</span>
          <div>
            <WrappedElement />
          </div>
        </div>
      );

      const app = (
        <ApolloProvider client={apolloClient}>
          <Page />
        </ApolloProvider>
      );

      return getDataFromTree(app).catch((e) => {
        expect(e).toBeTruthy();
        expect(e.toString()).toMatch(/Failed to fetch/);
      });
    });

    it("should correctly skip queries (deprecated)", () => {
      const query = gql`
        {
          currentUser {
            firstName
          }
        }
      `;
      const link = mockSingleLink({
        request: { query },
        result: { data: { currentUser: { firstName: "James" } } },
      });
      const apolloClient = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      interface Props {}
      interface Data {
        currentUser: {
          firstName: string;
        };
      }
      const WrappedElement = graphql<Props, Data>(query, {
        skip: true,
      })(({ data }: ChildProps<Props, Data>) => (
        <div>{!data ? "skipped" : "dang"}</div>
      ));

      const app = (
        <ApolloProvider client={apolloClient}>
          <WrappedElement />
        </ApolloProvider>
      );

      return getDataFromTree(app).then((markup) => {
        expect(markup).toMatch(/skipped/);
      });
    });

    it("should use the correct default props for a query", () => {
      const query = gql`
        query user($id: ID) {
          currentUser(id: $id) {
            firstName
          }
        }
      `;
      const resultData = { currentUser: { firstName: "James" } };
      const variables = { id: "1" };
      const link = mockSingleLink({
        request: { query, variables },
        result: { data: resultData },
      });

      const cache = new Cache({ addTypename: false });
      const apolloClient = new ApolloClient({
        link,
        cache,
      });

      interface Props {
        id: string;
      }
      interface Data {
        currentUser: {
          firstName: string;
        };
      }
      interface Variables {
        id: string;
      }
      const Element = graphql<Props, Data, Variables>(query)(
        ({ data }: ChildProps<Props, Data, Variables>) => (
          <div>
            {!data || data.loading || !data.currentUser ?
              "loading"
            : data.currentUser.firstName}
          </div>
        )
      );

      const app = (
        <ApolloProvider client={apolloClient}>
          <Element id={"1"} />
        </ApolloProvider>
      );

      return getDataFromTree(app).then(() => {
        const initialState = cache.extract();
        expect(initialState).toBeTruthy();
        expect(
          initialState.ROOT_QUERY!['currentUser({"id":"1"})']
        ).toBeTruthy();
      });
    });

    itAsync(
      "should allow for setting state in a component",
      (resolve, reject) => {
        const query = gql`
          query user($id: ID) {
            currentUser(id: $id) {
              firstName
            }
          }
        `;
        const resultData = { currentUser: { firstName: "James" } };
        const variables = { id: "1" };
        const link = mockSingleLink({
          request: { query, variables },
          result: { data: resultData },
        });

        const cache = new Cache({ addTypename: false });
        const apolloClient = new ApolloClient({
          link,
          cache,
        });

        interface Props {
          id: string;
        }
        interface Data {
          currentUser: {
            firstName: string;
          };
        }
        interface Variables {
          id: string;
        }

        class Element extends React.Component<
          ChildProps<Props, Data, Variables>,
          { thing: number }
        > {
          state = { thing: 1 };

          static getDerivedStateFromProps() {
            return {
              thing: 2,
            };
          }

          render() {
            const { data } = this.props;
            expect(this.state.thing).toBe(2);
            return (
              <div>
                {!data || data.loading || !data.currentUser ?
                  "loading"
                : data.currentUser.firstName}
              </div>
            );
          }
        }

        const ElementWithData = graphql<Props, Data, Variables>(query)(Element);

        const app = (
          <ApolloProvider client={apolloClient}>
            <ElementWithData id={"1"} />
          </ApolloProvider>
        );

        getDataFromTree(app)
          .then(() => {
            const initialState = cache.extract();
            expect(initialState).toBeTruthy();
            expect(
              initialState.ROOT_QUERY!['currentUser({"id":"1"})']
            ).toBeTruthy();
            resolve();
          })
          .catch(console.error);
      }
    );

    it("should correctly initialize an empty state to null", () => {
      class Element extends React.Component<any, any> {
        render() {
          expect(this.state).toBeNull();
          return null;
        }
      }

      return getDataFromTree(<Element />);
    });

    it("should maintain any state set in the element constructor", () => {
      class Element extends React.Component<{}, { foo: string }> {
        constructor(props: {}) {
          super(props);
          this.state = { foo: "bar" };
        }

        render() {
          expect(this.state).toEqual({ foo: "bar" });
          return null;
        }
      }

      return getDataFromTree(<Element />);
    });

    itAsync("should allow prepping state from props", (resolve, reject) => {
      const query = gql`
        query user($id: ID) {
          currentUser(id: $id) {
            firstName
          }
        }
      `;
      const resultData = { currentUser: { firstName: "James" } };
      const variables = { id: "1" };
      const link = mockSingleLink({
        request: { query, variables },
        result: { data: resultData },
      });
      const apolloClient = new ApolloClient({
        link,
        cache: new Cache({
          addTypename: false,
        }),
      });
      interface Props {
        id: string;
      }
      interface Data {
        currentUser: {
          firstName: string;
        };
      }
      interface Variables {
        id: string;
      }

      interface State {
        thing: number;
        userId: null | number;
        client: null | ApolloClient<any>;
      }

      class Element extends React.Component<
        ChildProps<Props, Data, Variables>,
        State
      > {
        state: State = {
          thing: 1,
          userId: null,
          client: null,
        };

        static getDerivedStateFromProps(props: Props, state: State) {
          return {
            thing: state.thing + 1,
            userId: props.id,
            client: apolloClient,
          };
        }

        render() {
          const { data, id } = this.props;
          expect(this.state.thing).toBe(2);
          expect(this.state.userId).toBe(id);
          expect(this.state.client).toBe(apolloClient);
          return (
            <div>
              {!data || data.loading || !data.currentUser ?
                "loading"
              : data.currentUser.firstName}
            </div>
          );
        }
      }

      const ElementWithData = graphql<Props, Data, Variables>(query)(Element);

      const app = (
        <ApolloProvider client={apolloClient}>
          <ElementWithData id={"1"} />
        </ApolloProvider>
      );

      getDataFromTree(app)
        .then(() => {
          const initialState = apolloClient.cache.extract();
          expect(initialState).toBeTruthy();
          expect(
            initialState.ROOT_QUERY!['currentUser({"id":"1"})']
          ).toBeTruthy();
          resolve();
        })
        .catch(console.error);
    });

    it("shouldn't run queries if ssr is turned to off", () => {
      const query = gql`
        query user($id: ID) {
          currentUser(id: $id) {
            firstName
          }
        }
      `;
      const resultData = { currentUser: { firstName: "James" } };
      const variables = { id: "1" };
      const link = mockSingleLink({
        request: { query, variables },
        result: { data: resultData },
      });

      const cache = new Cache({ addTypename: false });
      const apolloClient = new ApolloClient({
        link,
        cache,
      });

      interface Data {
        currentUser: {
          firstName: string;
        };
      }

      interface Props {
        id: string;
      }
      interface Data {
        currentUser: {
          firstName: string;
        };
      }
      interface Variables {
        id: string;
      }

      const Element = graphql<Props, Data, Variables>(query, {
        options: (props) => ({ variables: props, ssr: false }),
      })(({ data }) => (
        <div>
          {!data || data.loading || !data.currentUser ?
            "loading"
          : data.currentUser.firstName}
        </div>
      ));

      const app = (
        <ApolloProvider client={apolloClient}>
          <Element id={"1"} />
        </ApolloProvider>
      );

      return getDataFromTree(app).then(() => {
        const initialState = cache.extract();
        expect(initialState).toEqual({});
        expect(initialState).toEqual({});
      });
    });

    it("shouldn't run queries (via Query component) if ssr is turned to off", () => {
      const query = gql`
        query user($id: ID) {
          currentUser(id: $id) {
            firstName
          }
        }
      `;
      const resultData = { currentUser: { firstName: "James" } };
      const variables = { id: "1" };
      const link = mockSingleLink({
        request: { query, variables },
        result: { data: resultData },
      });

      const cache = new Cache({ addTypename: false });
      const apolloClient = new ApolloClient({
        link,
        cache,
      });

      interface Data {
        currentUser?: {
          firstName: string;
        };
      }

      const Element = (props: { id: string }) => (
        <Query query={query} ssr={false} variables={props}>
          {({ data, loading }: { data: Data; loading: boolean }) => (
            <div>
              {loading || !data ? "loading" : data.currentUser!.firstName}
            </div>
          )}
        </Query>
      );

      const app = (
        <ApolloProvider client={apolloClient}>
          <Element id={"1"} />
        </ApolloProvider>
      );

      return getDataFromTree(app).then(() => {
        const initialState = cache.extract();
        expect(initialState).toEqual({});
        expect(initialState).toEqual({});
      });
    });

    it("should correctly handle SSR mutations", () => {
      const query = gql`
        {
          currentUser {
            firstName
          }
        }
      `;
      const data1 = { currentUser: { firstName: "James" } };

      const mutation = gql`
        mutation {
          logRoutes {
            id
          }
        }
      `;
      const mutationData = { logRoutes: { id: "foo" } };

      const link = mockSingleLink(
        { request: { query }, result: { data: data1 } },
        {
          request: { query: mutation },
          result: { data: mutationData },
        }
      );
      const apolloClient = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      interface Data {
        currentUser: {
          firstName: string;
        };
      }
      interface QueryProps {}
      interface QueryChildProps {
        refetchQuery: Function;
        data: DataValue<Data>;
      }

      const withQuery = graphql<QueryProps, Data, {}, QueryChildProps | {}>(
        query,
        {
          options: () => ({ ssr: true }),
          props: ({ data }) => {
            if (data!.loading) return {};
            expect(data!.refetch).toBeTruthy();
            return {
              refetchQuery: data!.refetch,
              data: data!,
            };
          },
        }
      );

      const withMutation = graphql<
        QueryChildProps,
        {},
        {},
        { action: (variables: {}) => Promise<any> }
      >(mutation, {
        props: ({ ownProps, mutate }: any) => {
          if (ownProps.loading || typeof ownProps.loading === "undefined")
            return { action: () => Promise.resolve() };
          expect(ownProps.refetchQuery).toBeTruthy();
          return {
            action(variables: {}) {
              return mutate!({ variables }).then(() => ownProps.refetchQuery());
            },
          };
        },
      });

      const Element: React.FunctionComponent<
        React.PropsWithChildren<
          React.PropsWithChildren<
            QueryChildProps & {
              action: (variables: {}) => Promise<any>;
            }
          >
        >
      > = ({ data }) => (
        <div>
          {!data || data.loading || !data.currentUser ?
            "loading"
          : data.currentUser.firstName}
        </div>
      );

      // @ts-expect-error
      const WrappedElement = withQuery(withMutation(Element));

      const app = (
        <ApolloProvider client={apolloClient}>
          <WrappedElement />
        </ApolloProvider>
      );

      return getDataFromTree(app).then((markup) => {
        expect(markup).toMatch(/James/);
      });
    });

    it("should correctly handle SSR mutations, reverse order", () => {
      const query = gql`
        {
          currentUser {
            firstName
          }
        }
      `;

      interface Props {}
      interface QueryData {
        currentUser: {
          firstName: string;
        };
      }

      const mutation = gql`
        mutation {
          logRoutes {
            id
          }
        }
      `;
      interface MutationData {
        logRoutes: {
          id: string;
        };
      }

      const link = mockSingleLink(
        {
          request: { query },
          result: { data: { currentUser: { firstName: "James" } } },
        },
        {
          request: { query: mutation },
          result: { data: { logRoutes: { id: "foo" } } },
        }
      );
      const apolloClient = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      const withMutation = graphql<Props, MutationData>(mutation);
      const withQuery = graphql<
        Props & ChildProps<Props, MutationData>,
        QueryData
      >(query, {
        props: ({ ownProps, data }) => {
          expect(ownProps.mutate).toBeTruthy();
          return {
            data,
          };
        },
      });

      const Element: React.FunctionComponent<
        React.PropsWithChildren<
          React.PropsWithChildren<
            ChildProps<ChildProps<Props, MutationData>, QueryData, {}>
          >
        >
      > = ({ data }) => (
        <div>
          {!data || data.loading || !data.currentUser ?
            "loading"
          : data.currentUser.firstName}
        </div>
      );

      const WrappedElement = withMutation(withQuery(Element));

      const app = (
        <ApolloProvider client={apolloClient}>
          <WrappedElement />
        </ApolloProvider>
      );

      return getDataFromTree(app).then((markup) => {
        expect(markup).toMatch(/James/);
      });
    });

    it("should not require `ApolloProvider` to be the root component", () => {
      const query = gql`
        {
          currentUser {
            firstName
          }
        }
      `;
      interface Data {
        currentUser: {
          firstName: string;
        };
      }

      const link = mockSingleLink({
        request: { query },
        result: { data: { currentUser: { firstName: "James" } } },
      });
      const apolloClient = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      const WrappedElement = graphql<{}, Data>(query)(
        ({ data }: ChildProps<{}, Data>) => (
          <div>
            {!data || data.loading || !data.currentUser ?
              "loading"
            : data.currentUser.firstName}
          </div>
        )
      );

      class MyRootContainer extends React.Component<
        React.PropsWithChildren,
        { color: string }
      > {
        constructor(props: {}) {
          super(props);
          this.state = { color: "purple" };
        }

        getChildContext() {
          return { color: this.state.color };
        }

        render() {
          return <div>{this.props.children}</div>;
        }
      }

      (MyRootContainer as any).childContextTypes = {
        color: PropTypes.string,
      };

      const app = (
        <MyRootContainer>
          <ApolloProvider client={apolloClient}>
            <WrappedElement />
          </ApolloProvider>
        </MyRootContainer>
      );

      return getDataFromTree(app).then((markup) => {
        expect(markup).toMatch(/James/);
      });
    });
  });
});
