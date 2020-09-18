import React from 'react';
import { DocumentNode } from 'graphql';
import gql from 'graphql-tag';
import {cleanup, render, wait} from '@testing-library/react';

import { InMemoryCache } from '../../../cache';
import { MockedProvider } from '../../../testing';
import { useCachedMutation } from '../useCachedMutation';

describe('useCachedMutation Hook', () => {

  const CREATE_TODO_MUTATION: DocumentNode = gql`
    mutation createTodo($description: String!) {
      createTodo(description: $description) {
        id
        description
        priority
      }
    }
  `;

  const FRAGMENT = gql`
    fragment NewTodo on createTodo {
      id
      description
      priority
      __typename
    }
  `;

  const PAGINATION_FRAGMENT = gql`
    fragment NewTodo on Todo {
      todos {
        id
        description
        priority
        __typename
      }
      totalPages
    }
  `

  const CACHE = {
    todos: [
      {
        id: 1,
        description: 'Make the new apollo-client hook 😎!',
        priority: 'High',
        __typename: 'Todo'
      }
    ]
  }

  const PAGINATION_CACHE = {
    todos: {
      todos: [
        {
          id: 1,
          description: 'Make the new apollo-client hook 😎!',
          priority: 'High',
          __typename: 'Todo'
        }
      ],
      totalPages: 2
    }
  }

  const CREATE_TODO_RESULT = {
    createTodo: {
      id: 2,
      description: 'Get Coffe!',
      priority: 'High',
      __typename: 'Todo'
    }
  };

  const CACHE_AFTER_CREATE = {
    todos: [
      {
        id: 1,
        description: 'Make the new apollo-client hook 😎!',
        priority: 'High',
        __typename: 'Todo'
      },
      {
        id: 2,
        description: 'Get Coffe!',
        priority: 'High',
        __typename: 'Todo'
      }
    ]
  }

  const PAGINATION_CACHE_AFTER_CREATE = {
    todos: {
      todos: [
        {
          id: 2,
          description: 'Get Coffe!',
          priority: 'High',
          __typename: 'Todo'
        },
        {
          id: 1,
          description: 'Make the new apollo-client hook 😎!',
          priority: 'High',
          __typename: 'Todo'
        },
      ],
      totalPages: 2
    }
  }

  const EMPTY_CACHE_AFTER_CREATE = {
    todos: [
      {
        id: 2,
        description: 'Get Coffe!',
        priority: 'High',
        __typename: 'Todo'
      }
    ]
  }

  const TODO_QUERY: DocumentNode = gql`
    query {
      todos {
        id
        description
        priority
        __typename
      }
    }
  `;

  const TODO_PAGINATION_QUERY: DocumentNode = gql`
    query GetTodos {
      todos {
        todos {
          id
          description
          priority
          __typename
        }
        totalPages
      }
    }
  `;

  beforeEach(() => {
    jest.setTimeout(10000);
  });

  afterEach(cleanup);

  describe('General use', () => {
    it('should clean the cache after execute the mutation', async () => {
      const variables = {
        description: 'Get coffe!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      let renderCount = 0;
      const Component = () => {

        const [createTodo, { loading, data }] = useCachedMutation(
          CREATE_TODO_MUTATION,
          FRAGMENT,
          {
            mutationName: 'createTodo',
            rootCacheId: 'todos'
          }
        );

        switch (renderCount) {
          case 0:
            expect(loading).toBeFalsy();
            expect(data).toBeUndefined();
            createTodo({ variables });
            break;
          case 1:
            expect(loading).toBeTruthy();
            expect(data).toBeUndefined();
            break;
          case 2:
            expect(loading).toBeFalsy();
            expect(data).toEqual(CREATE_TODO_RESULT);
            break;
          default:
        }
        renderCount += 1;
        return null;
      };

      const cache = new InMemoryCache();

      cache.writeQuery({
        query: TODO_QUERY,
        data: CACHE
      })

      render(
        <MockedProvider mocks={mocks} cache={cache}>
          <Component />
        </MockedProvider>
      );

      return wait(() => {
        const cacheData = cache.read({ query: TODO_QUERY, optimistic: false });
        expect(cacheData).toEqual(CACHE_AFTER_CREATE);
        expect(renderCount).toBe(3);
      });
    });

    it('should mutate and clean the cache passing the updateKey option', async () => {
      const variables = {
        description: 'Get coffe!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      let renderCount = 0;
      const Component = () => {

        const [createTodo, { loading, data }] = useCachedMutation(
          CREATE_TODO_MUTATION,
          PAGINATION_FRAGMENT,
          {
            mutationName: 'createTodo',
            rootCacheId: 'todos',
          }
        );

        switch (renderCount) {
          case 0:
            expect(loading).toBeFalsy();
            expect(data).toBeUndefined();
            createTodo({ variables });
            break;
          case 1:
            expect(loading).toBeTruthy();
            expect(data).toBeUndefined();
            break;
          case 2:
            expect(loading).toBeFalsy();
            expect(data).toEqual(CREATE_TODO_RESULT);
            break;
          default:
        }
        renderCount += 1;
        return null;
      };

      const cache = new InMemoryCache();

      cache.writeQuery({
        query: TODO_QUERY,
        data: {
          todos: []
        }
      })

      render(
        <MockedProvider mocks={mocks} cache={cache}>
          <Component />
        </MockedProvider>
      );

      return wait(() => {
        const cacheData = cache.read({ query: TODO_QUERY, optimistic: false });
        expect(cacheData).toEqual(EMPTY_CACHE_AFTER_CREATE);
        expect(renderCount).toBe(3);
      });
    });

    it('should update the cache of a specific key', async () => {
      const variables = {
        description: 'Get coffe!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      let renderCount = 0;
      const Component = () => {

        const [createTodo, { loading, data }] = useCachedMutation(
          CREATE_TODO_MUTATION,
          PAGINATION_FRAGMENT,
          {
            mutationName: 'createTodo',
            rootCacheId: 'todos',
            updateKey: 'todos'
          }
        );

        switch (renderCount) {
          case 0:
            expect(loading).toBeFalsy();
            expect(data).toBeUndefined();
            createTodo({ variables });
            break;
          case 1:
            expect(loading).toBeTruthy();
            expect(data).toBeUndefined();
            break;
          case 2:
            expect(loading).toBeFalsy();
            expect(data).toEqual(CREATE_TODO_RESULT);
            break;
          default:
        }
        renderCount += 1;
        return null;
      };

      const cache = new InMemoryCache();

      cache.writeQuery({
        query: TODO_PAGINATION_QUERY,
        data: PAGINATION_CACHE,
      })

      render(
        <MockedProvider mocks={mocks} cache={cache}>
          <Component />
        </MockedProvider>
      );

      return wait(() => {
        const cacheData = cache.read({ query: TODO_PAGINATION_QUERY, optimistic: false })
        expect(cacheData).toEqual(PAGINATION_CACHE_AFTER_CREATE);
        expect(renderCount).toBe(3);
      });
    });
  })
});
