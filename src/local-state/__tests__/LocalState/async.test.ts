import { ApolloClient, InMemoryCache } from "@apollo/client";
import { ApolloLink } from "@apollo/client/link";
import { LocalState } from "@apollo/client/local-state";
import { wait } from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("supports async @client resolvers", async () => {
  const document = gql`
    query Member {
      isLoggedIn @client
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const localState = new LocalState({
    resolvers: {
      Query: {
        async isLoggedIn() {
          return Promise.resolve(true);
        },
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({
    data: { isLoggedIn: true },
  });
});

test("handles nested asynchronous @client resolvers", async () => {
  const document = gql`
    query DeveloperTicketComments($id: ID) {
      developer(id: $id) @client {
        id
        handle
        tickets @client {
          id
          comments @client {
            id
          }
        }
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  async function randomDelay(range: number) {
    await wait(Math.round(Math.random() * range));
  }

  function uuid() {
    return Math.random().toString(36).slice(2);
  }

  const developerId = uuid();

  function times<T>(n: number, thunk: () => T): T[] {
    const result: T[] = [];
    for (let i = 0; i < n; ++i) {
      result.push(thunk());
    }
    return result;
  }

  const ticketsPerDev = 5;
  const commentsPerTicket = 5;

  const localState = new LocalState({
    resolvers: {
      Query: {
        async developer(_, { id }) {
          await randomDelay(50);
          expect(id).toBe(developerId);
          return {
            __typename: "Developer",
            id,
            handle: "@benjamn",
          };
        },
      },
      Developer: {
        async tickets(developer) {
          await randomDelay(50);
          expect(developer.__typename).toBe("Developer");

          return Promise.all(
            times(ticketsPerDev, () => ({
              __typename: "Ticket",
              id: uuid(),
            }))
          );
        },
      },
      Ticket: {
        async comments(ticket) {
          await randomDelay(50);
          expect(ticket.__typename).toBe("Ticket");

          return Promise.all(
            times(commentsPerTicket, () => ({
              __typename: "Comment",
              id: uuid(),
            }))
          );
        },
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: { id: developerId },
      remoteResult: undefined,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      developer: {
        __typename: "Developer",
        id: developerId,
        handle: "@benjamn",
        tickets: times(ticketsPerDev, () => ({
          __typename: "Ticket",
          id: expect.any(String),
          comments: times(commentsPerTicket, () => ({
            __typename: "Comment",
            id: expect.any(String),
          })),
        })),
      },
    },
  });
});

test("supports async @client resolvers mixed with remotely resolved data", async () => {
  const document = gql`
    query Member {
      member {
        name
        sessionCount @client
        isLoggedIn @client
      }
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const testMember = {
    name: "John Smithsonian",
    isLoggedIn: true,
    sessionCount: 10,
  };

  const remoteResult = {
    data: {
      member: {
        name: testMember.name,
        __typename: "Member",
      },
    },
  };

  const localState = new LocalState({
    resolvers: {
      Member: {
        async isLoggedIn() {
          return Promise.resolve(testMember.isLoggedIn);
        },
        sessionCount() {
          return testMember.sessionCount;
        },
      },
    },
  });

  await expect(
    localState.execute({
      document,
      client,
      context: {},
      variables: {},
      remoteResult,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      member: {
        name: testMember.name,
        isLoggedIn: testMember.isLoggedIn,
        sessionCount: testMember.sessionCount,
        __typename: "Member",
      },
    },
  });
});
