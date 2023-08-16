import React from "react";
import { render, waitFor } from "@testing-library/react";
import gql from "graphql-tag";
import { DocumentNode } from "graphql";

import { ApolloClient } from "../../../../core";
import { ApolloProvider } from "../../../context";
import { InMemoryCache as Cache } from "../../../../cache";
import { itAsync, mockSingleLink } from "../../../../testing";
import { graphql } from "../../graphql";
import { DataValue } from "../../types";

describe("[queries] reducer", () => {
  // props reducer
  itAsync("allows custom mapping of a result to props", (resolve, reject) => {
    const query: DocumentNode = gql`
      query thing {
        getThing {
          thing
        }
      }
    `;
    const result = { getThing: { thing: true } };
    const link = mockSingleLink({
      request: { query },
      result: { data: result },
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    type Data = typeof result;
    // in case of a skip
    type ChildProps = DataValue<Data>;

    let count = 0;
    const ContainerWithData = graphql<{}, Data, {}, ChildProps>(query, {
      props: ({ data }) => ({ ...data! }),
    })(({ getThing, loading }) => {
      count++;
      if (count === 1) expect(loading).toBe(true);
      if (count === 2) {
        expect(getThing).toBeDefined();
      }
      return null;
    });

    render(
      <ApolloProvider client={client}>
        <ContainerWithData />
      </ApolloProvider>
    );

    waitFor(() => expect(count).toBe(2)).then(resolve, reject);
  });

  itAsync(
    "allows custom mapping of a result to props that includes the passed props",
    (resolve, reject) => {
      const query: DocumentNode = gql`
        query thing {
          getThing {
            thing
          }
        }
      `;
      const link = mockSingleLink({
        request: { query },
        result: { data: { getThing: { thing: true } } },
      });
      const client = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      interface Data {
        getThing: { thing: boolean };
      }
      interface Props {
        sample: number;
      }

      type FinalProps = {
        showSpinner: boolean;
      };

      let count = 0;
      const ContainerWithData = graphql<Props, Data, {}, FinalProps>(query, {
        props: ({ data, ownProps }) => {
          expect(ownProps.sample).toBe(1);
          return { showSpinner: data!.loading };
        },
      })(({ showSpinner }: FinalProps) => {
        if (count === 0) {
          expect(showSpinner).toBeTruthy();
        }
        count += 1;
        return null;
      });

      render(
        <ApolloProvider client={client}>
          <ContainerWithData sample={1} />
        </ApolloProvider>
      );

      waitFor(() => {
        expect(count).toBe(2);
      }).then(resolve, reject);
    }
  );

  itAsync("allows custom mapping of a result to props 2", (resolve, reject) => {
    let done = false;
    const query: DocumentNode = gql`
      query thing {
        getThing {
          thing
        }
      }
    `;
    const expectedData = { getThing: { thing: true } };
    const link = mockSingleLink({
      request: { query },
      result: { data: expectedData },
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false }),
    });

    interface Data {
      getThing: { thing: boolean };
    }

    interface FinalProps {
      thingy: { thing: boolean };
    }

    const withData = graphql<{}, Data, {}, FinalProps>(query, {
      props: ({ data }) => ({ thingy: data!.getThing! }),
    });

    class Container extends React.Component<FinalProps> {
      componentDidUpdate() {
        expect(this.props.thingy).toEqual(expectedData.getThing);
        done = true;
      }
      render() {
        return null;
      }
    }

    const ContainerWithData = withData(Container);

    render(
      <ApolloProvider client={client}>
        <ContainerWithData />
      </ApolloProvider>
    );

    waitFor(() => {
      expect(done).toBe(true);
    }).then(resolve, reject);
  });

  itAsync(
    "passes the prior props to the result-props mapper",
    (resolve, reject) => {
      const query: DocumentNode = gql`
        query thing {
          getThing {
            thing
          }
          other
        }
      `;
      const expectedData = { getThing: { thing: true }, other: false };
      const expectedDataAfterRefetch = {
        getThing: { thing: true },
        other: true,
      };
      const link = mockSingleLink(
        {
          request: { query },
          result: { data: expectedData },
        },
        {
          request: { query },
          result: { data: expectedDataAfterRefetch },
        }
      );
      const client = new ApolloClient({
        link,
        cache: new Cache({ addTypename: false }),
      });

      type Data = typeof expectedData;
      interface FinalProps {
        wrapper: { thingy: { thing: boolean } };
        refetch: () => any;
      }

      const withData = graphql<{}, Data, {}, FinalProps>(query, {
        props: ({ data }, lastProps) => {
          const refetch = data!.refetch!;
          let wrapper = { thingy: data!.getThing! };

          // If the current thingy is equal to the last thingy,
          // reuse the wrapper (to preserve referential equality).
          if (lastProps && lastProps.wrapper.thingy === wrapper.thingy) {
            wrapper = lastProps!.wrapper!;
          }

          return { wrapper, refetch };
        },
      });

      let counter = 0;
      let done = false;
      class Container extends React.Component<FinalProps> {
        componentDidUpdate(nextProps: FinalProps) {
          expect(this.props.wrapper.thingy).toEqual(expectedData.getThing);
          if (counter === 1) {
            expect(this.props.wrapper).toEqual(nextProps.wrapper);
            done = true;
          } else {
            counter++;
            this.props.refetch();
          }
        }
        render() {
          return null;
        }
      }

      const ContainerWithData = withData(Container);

      render(
        <ApolloProvider client={client}>
          <ContainerWithData />
        </ApolloProvider>
      );

      waitFor(() => expect(done).toBeTruthy()).then(resolve, reject);
    }
  );
});
