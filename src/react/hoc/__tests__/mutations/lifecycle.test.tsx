import React from 'react';
import { render, cleanup } from '@testing-library/react';
import gql from 'graphql-tag';

import { ApolloProvider } from '../../../context/ApolloProvider';
import { stripSymbols } from '../../../../utilities/testing/stripSymbols';
import { createMockClient } from '../../../../utilities/testing/mocking/mockClient';
import { graphql } from '../../graphql';
import { ChildProps } from '../../types';

const query = gql`
  mutation addPerson($id: Int) {
    allPeople(id: $id) {
      people {
        name
      }
    }
  }
`;
const expectedData = {
  allPeople: { people: [{ name: 'Luke Skywalker' }] }
};

describe('graphql(mutation) lifecycle', () => {
  afterEach(cleanup);

  it('allows falsy values in the mapped variables from props', done => {
    const client = createMockClient(expectedData, query, { id: null });

    interface Props {
      id: string | null;
    }

    const Container = graphql<Props>(query)(
      class extends React.Component<ChildProps<Props>> {
        componentDidMount() {
          this.props.mutate!().then(result => {
            expect(stripSymbols(result && result.data)).toEqual(expectedData);
            done();
          });
        }

        render() {
          return null;
        }
      }
    );

    render(
      <ApolloProvider client={client}>
        <Container id={null} />
      </ApolloProvider>
    );
  });

  it("errors if the passed props don't contain the needed variables", () => {
    const client = createMockClient(expectedData, query, { first: 1 });
    interface Props {
      frst: number;
    }
    const Container = graphql<Props>(query)(() => null);
    try {
      render(
        <ApolloProvider client={client}>
          <Container frst={1} />
        </ApolloProvider>
      );
    } catch (e) {
      expect(e).toMatch(/Invariant Violation: The operation 'addPerson'/);
    }
  });

  it('rebuilds the mutation on prop change when using `options`', done => {
    const client = createMockClient(expectedData, query, {
      id: 2
    });

    interface Props {
      listId: number;
    }
    function options(props: Props) {
      return {
        variables: {
          id: props.listId
        }
      };
    }

    class Container extends React.Component<ChildProps<Props>> {
      render() {
        if (this.props.listId !== 2) return null;
        this.props.mutate!().then(() => done());
        return null;
      }
    }

    const ContainerWithMutate = graphql<Props>(query, { options })(Container);

    class ChangingProps extends React.Component<{}, { listId: number }> {
      state = { listId: 1 };

      componentDidMount() {
        setTimeout(() => this.setState({ listId: 2 }), 50);
      }

      render() {
        return <ContainerWithMutate listId={this.state.listId} />;
      }
    }

    render(
      <ApolloProvider client={client}>
        <ChangingProps />
      </ApolloProvider>
    );
  });

  it('can execute a mutation with custom variables', done => {
    const client = createMockClient(expectedData, query, { id: 1 });
    interface Variables {
      id: number;
    }

    const Container = graphql<{}, {}, Variables>(query)(
      class extends React.Component<ChildProps<{}, {}, Variables>> {
        componentDidMount() {
          this.props.mutate!({ variables: { id: 1 } }).then(result => {
            expect(stripSymbols(result && result.data)).toEqual(expectedData);
            done();
          });
        }
        render() {
          return null;
        }
      }
    );

    render(
      <ApolloProvider client={client}>
        <Container />
      </ApolloProvider>
    );
  });
});
