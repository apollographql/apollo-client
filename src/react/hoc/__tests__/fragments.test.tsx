import React from 'react';
import { render, wait } from '@testing-library/react';
import gql from 'graphql-tag';
import { DocumentNode } from 'graphql';

import { ApolloClient } from '../../../core';
import { ApolloProvider } from '../../context';
import { InMemoryCache as Cache } from '../../../cache';
import { itAsync, stripSymbols, mockSingleLink } from '../../../testing';
import { graphql } from '../graphql';
import { ChildProps } from '../types';

describe('fragments', () => {
  // XXX in a later version, we should support this for composition
  it('throws if you only pass a fragment', () => {
    const query: DocumentNode = gql`
      fragment Failure on PeopleConnection {
        people {
          name
        }
      }
    `;
    const expectedData = {
      allPeople: { people: [{ name: 'Luke Skywalker' }] }
    };
    type Data = typeof expectedData;

    const link = mockSingleLink({
      request: { query },
      result: { data: expectedData }
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    try {
      const Container = graphql<{}, Data>(query)(
        class extends React.Component<ChildProps<{}, Data>> {
          componentDidUpdate() {
            const { props } = this;
            expect(props.data!.loading).toBeFalsy();
            expect(stripSymbols(props.data!.allPeople)).toEqual(
              expectedData.allPeople
            );
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
      throw new Error();
    } catch (e) {
      expect(e.name).toMatch(/Invariant Violation/);
    }
  });

  itAsync('correctly fetches a query with inline fragments', (resolve, reject) => {
    const query: DocumentNode = gql`
      query people {
        allPeople(first: 1) {
          __typename
          ...person
        }
      }

      fragment person on PeopleConnection {
        people {
          name
        }
      }
    `;
    const data = {
      allPeople: {
        __typename: 'PeopleConnection',
        people: [{ name: 'Luke Skywalker' }]
      }
    };

    type Data = typeof data;

    const link = mockSingleLink({
      request: { query },
      result: { data }
    });
    const client = new ApolloClient({
      link,
      cache: new Cache({ addTypename: false })
    });

    const Container = graphql<{}, Data>(query)(
      class extends React.Component<ChildProps<{}, Data>> {
        componentDidUpdate() {
          expect(this.props.data!.loading).toBeFalsy();
          expect(stripSymbols(this.props.data!.allPeople)).toEqual(
            data.allPeople
          );
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

    return wait().then(resolve, reject);
  });
});
