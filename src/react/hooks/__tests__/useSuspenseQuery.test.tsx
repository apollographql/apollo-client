import React, { Suspense } from 'react';
import { render, screen } from "@testing-library/react";
import { renderHook } from '@testing-library/react-hooks';
import { InvariantError } from 'ts-invariant';

import {
  gql,
  ApolloClient,
  InMemoryCache,
  TypedDocumentNode
} from "../../../core";
import { MockedProvider } from '../../../testing';
import { ApolloProvider } from '../../context';
import { SuspenseCache } from '../../cache';
import {
  useSuspenseQuery_experimental as useSuspenseQuery,
  UseSuspenseQueryResult
} from '../useSuspenseQuery';

describe('useSuspenseQuery', () => {
  it('is importable and callable', () => {
    expect(typeof useSuspenseQuery).toBe('function');
  });

  it('validates the GraphQL query as a query', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const query = gql`
      mutation ShouldThrow {
        createException
      }
    `;

    const { result } = renderHook(() => useSuspenseQuery(query), {
      wrapper: ({ children }) => <MockedProvider>{children}</MockedProvider>
    });

    expect(result.error).toEqual(
      new InvariantError(
        'Running a Query requires a graphql Query, but a Mutation was used instead.'
      )
    );

    consoleSpy.mockRestore();
  });

  it('ensures a suspense cache is provided', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const query = gql`
      query { hello }
    `;

    const client = new ApolloClient({ cache: new InMemoryCache() });

    const { result } = renderHook(() => useSuspenseQuery(query), {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      )
    });

    expect(result.error).toEqual(
      new InvariantError(
        'Could not find a "suspenseCache" in the context. Wrap the root component ' +
        'in an <ApolloProvider> and provide a suspenseCache.'
      )
    );

    consoleSpy.mockRestore();
  });


  it('suspends a query and return results', async () => {
    interface QueryData {
      greeting: string;
    };

    const query: TypedDocumentNode<QueryData> = gql`
      query UserQuery {
        greeting
      }
    `;

    const results: UseSuspenseQueryResult<QueryData>[] = [];
    let renders = 0;

    function Test() {
      renders++;
      const result = useSuspenseQuery(query);

      results.push(result);

      return <div>{result.data.greeting} suspense</div>;
    }

    render(
      <MockedProvider
        mocks={[
          {
            request: { query },
            result: { data: { greeting: 'Hello' } }
          },
        ]}
      >
        <Suspense fallback="loading">
          <Test />
        </Suspense>
      </MockedProvider>
    );

    expect(screen.getByText('loading')).toBeInTheDocument();

    const greeting = await screen.findByText('Hello suspense')

    expect(greeting).toBeInTheDocument();
    expect(renders).toBe(2);
    expect(results).toEqual([
      {
        data: { greeting: 'Hello' },
        variables: {}
      },
    ]);
  });

  it('suspends a query with variables and return results', async () => {
    interface QueryData {
      character: {
        id: string
        name: string
      };
    };

    interface QueryVariables {
      id: string
    }

    const query: TypedDocumentNode<QueryData, QueryVariables> = gql`
      query CharacterQuery($id: String!) {
        character(id: $id) {
          id
          name
        }
      }
    `;

    const results: UseSuspenseQueryResult<QueryData, QueryVariables>[] = [];
    let renders = 0;

    function Test() {
      renders++;
      const result = useSuspenseQuery(query, { variables: { id: '1' } });

      results.push(result);

      return <div>{result.data.character.name}</div>;
    }

    render(
      <MockedProvider
        mocks={[
          {
            request: { query, variables: { id: '1' } },
            result: { data: { character: { id: '1', name: 'Spider-Man' } } }
          },
        ]}
      >
        <Suspense fallback="loading">
          <Test />
        </Suspense>
      </MockedProvider>
    );

    expect(screen.getByText('loading')).toBeInTheDocument();

    const character = await screen.findByText('Spider-Man')

    expect(character).toBeInTheDocument();
    expect(renders).toBe(2);
    expect(results).toEqual([
      {
        data: { character: { id: '1', name: 'Spider-Man' }},
        variables: { id: '1' },
      },
    ]);
  });

  it('returns the same results for the same variables', async () => {
    interface QueryData {
      character: {
        id: string
        name: string
      };
    };

    interface QueryVariables {
      id: string
    }

    const query: TypedDocumentNode<QueryData, QueryVariables> = gql`
      query CharacterQuery($id: String!) {
        character(id: $id) {
          id
          name
        }
      }
    `;

    const suspenseCache = new SuspenseCache();

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: { data: { character: { id: '1', name: 'Spider-Man' } } }
      }
    ];

    const results: UseSuspenseQueryResult<QueryData, QueryVariables>[] = [];
    let renders = 0;

    function Test({ id }: { id: string }) {
      renders++;
      const result = useSuspenseQuery(query, {
        variables: { id }
      });

      results.push(result);

      return <div>{result.data.character.name}</div>;
    }

    const { rerender } = render(
      <MockedProvider mocks={mocks} suspenseCache={suspenseCache}>
        <Suspense fallback="loading">
          <Test id="1" />
        </Suspense>
      </MockedProvider>
    );

    expect(await screen.findByText('Spider-Man')).toBeInTheDocument();

    rerender(
      <MockedProvider mocks={mocks} suspenseCache={suspenseCache}>
        <Suspense fallback="loading">
          <Test id="1" />
        </Suspense>
      </MockedProvider>
    );

    expect(renders).toBe(3);
    expect(results).toEqual([
      {
        ...mocks[0].result,
        variables: { id: '1' },
      },
      {
        ...mocks[0].result,
        variables: { id: '1' },
      },
    ]);
  });

  it('re-suspends the component when changing variables and suspensePolicy is set to "always"', async () => {
    interface QueryData {
      character: {
        id: string
        name: string
      };
    };

    interface QueryVariables {
      id: string
    }

    const query: TypedDocumentNode<QueryData, QueryVariables> = gql`
      query CharacterQuery($id: String!) {
        character(id: $id) {
          id
          name
        }
      }
    `;

    const suspenseCache = new SuspenseCache();

    const mocks = [
      {
        request: { query, variables: { id: '1' } },
        result: { data: { character: { id: '1', name: 'Spider-Man' } } }
      },
      {
        request: { query, variables: { id: '2' } },
        result: { data: { character: { id: '2', name: 'Iron Man' } } }
      },
    ];

    const results: UseSuspenseQueryResult<QueryData, QueryVariables>[] = [];
    let renders = 0;

    function Test({ id }: { id: string }) {
      renders++;
      const result = useSuspenseQuery(query, {
        suspensePolicy: 'always',
        variables: { id }
      });

      results.push(result);

      return <div>{result.data.character.name}</div>;
    }

    const { rerender } = render(
      <MockedProvider mocks={mocks} suspenseCache={suspenseCache}>
        <Suspense fallback="loading">
          <Test id="1" />
        </Suspense>
      </MockedProvider>
    );

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('Spider-Man')).toBeInTheDocument();

    rerender(
      <MockedProvider mocks={mocks} suspenseCache={suspenseCache}>
        <Suspense fallback="loading">
          <Test id="2" />
        </Suspense>
      </MockedProvider>
    );

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('Iron Man')).toBeInTheDocument();

    expect(renders).toBe(4);
    expect(results).toEqual([
      {
        ...mocks[0].result,
        variables: { id: '1' },
      },
      {
        ...mocks[1].result,
        variables: { id: '2' },
      },
    ]);
  });


  it.skip('ensures a valid fetch policy is used', () => {});
  it.skip('result is referentially stable', () => {});
  it.skip('handles changing queries', () => {});
  it.skip('tears down the query on unmount', () => {});
});
