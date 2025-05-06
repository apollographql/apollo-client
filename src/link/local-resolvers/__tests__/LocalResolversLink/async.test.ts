import { of } from "rxjs";

import { ApolloLink } from "@apollo/client/link";
import { LocalResolversLink } from "@apollo/client/link/local-resolvers";
import { wait } from "@apollo/client/testing";
import {
  executeWithDefaultContext as execute,
  ObservableStream,
} from "@apollo/client/testing/internal";

import { gql } from "./testUtils.js";

test("supports async @local resolvers", async () => {
  const query = gql`
    query Member {
      isLoggedIn @local
    }
  `;

  const link = new LocalResolversLink({
    resolvers: {
      Query: {
        async isLoggedIn() {
          return Promise.resolve(true);
        },
      },
    },
  });

  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: { isLoggedIn: true },
  });
  await expect(stream).toComplete();
});

test("handles nested asynchronous @local resolvers", async () => {
  const query = gql`
    query DeveloperTicketComments($id: ID) {
      developer(id: $id) @local {
        id
        handle
        tickets @local {
          id
          comments @local {
            id
          }
        }
      }
    }
  `;

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

  const link = new LocalResolversLink({
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

  const stream = new ObservableStream(
    execute(link, { query, variables: { id: developerId } })
  );

  await expect(stream).toEmitTypedValue(
    {
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
    },
    { timeout: 1000 }
  );

  await expect(stream).toComplete();
});

test("supports async @local resolvers mixed with remotely resolved data", async () => {
  const query = gql`
    query Member {
      member {
        name
        sessionCount @local
        isLoggedIn @local
      }
    }
  `;

  const testMember = {
    name: "John Smithsonian",
    isLoggedIn: true,
    sessionCount: 10,
  };

  const mockLink = new ApolloLink(() =>
    of({
      data: {
        member: {
          name: testMember.name,
          __typename: "Member",
        },
      },
    })
  );

  const localResolversLink = new LocalResolversLink({
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

  const link = ApolloLink.from([localResolversLink, mockLink]);
  const stream = new ObservableStream(execute(link, { query }));

  await expect(stream).toEmitTypedValue({
    data: {
      member: {
        name: testMember.name,
        isLoggedIn: testMember.isLoggedIn,
        sessionCount: testMember.sessionCount,
        __typename: "Member",
      },
    },
  });
  await expect(stream).toComplete();
});
