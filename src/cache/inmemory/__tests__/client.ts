// This file contains InMemoryCache-specific tests that exercise the
// ApolloClient class. Other test modules in this directory only test
// InMemoryCache and related utilities, without involving ApolloClient.

import { ApolloClient, WatchQueryFetchPolicy, gql } from "../../../core";
import { ApolloLink } from "../../../link/core";
import { Observable } from "../../../utilities";
import { InMemoryCache } from "../..";
import { subscribeAndCount } from "../../../testing";

describe("InMemoryCache tests exercising ApolloClient", () => {
  it.each<WatchQueryFetchPolicy>([
    "cache-first",
    "network-only",
    "cache-and-network",
    "cache-only",
    "no-cache",
  ])(
    "results should be read from cache even when incomplete (fetchPolicy %s)",
    (fetchPolicy) => {
      const dateFromCache = "2023-09-14T13:03:22.616Z";
      const dateFromNetwork = "2023-09-15T13:03:22.616Z";

      const cache = new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              date: {
                read(existing) {
                  return new Date(existing || dateFromCache);
                },
              },
            },
          },
        },
      });

      const client = new ApolloClient({
        link: new ApolloLink(
          (operation) =>
            new Observable((observer) => {
              observer.next({
                data: {
                  // This raw string should be converted to a Date by the Query.date
                  // read function passed to InMemoryCache below.
                  date: dateFromNetwork,
                  // Make sure we don't accidentally return fields not mentioned in
                  // the query just because the result is incomplete.
                  ignored: "irrelevant to the subscribed query",
                  // Note the Query.missing field is, well, missing.
                },
              });
              setTimeout(() => {
                observer.complete();
              }, 10);
            })
        ),
        cache,
      });

      const query = gql`
        query {
          date
          missing
        }
      `;

      const observable = client.watchQuery({
        query,
        fetchPolicy, // Varies with each test iteration
        returnPartialData: true,
      });

      return new Promise<void>((resolve, reject) => {
        subscribeAndCount(reject, observable, (handleCount, result) => {
          let adjustedCount = handleCount;
          if (
            fetchPolicy === "network-only" ||
            fetchPolicy === "no-cache" ||
            fetchPolicy === "cache-only"
          ) {
            // The network-only, no-cache, and cache-only fetch policies do not
            // deliver a loading:true result initially, so we adjust the
            // handleCount to skip that case.
            ++adjustedCount;
          }

          // The only fetch policy that does not re-read results from the cache is
          // the "no-cache" policy. In this test, that means the Query.date field
          // will remain as a raw string rather than being converted to a Date by
          // the read function.
          const expectedDateAfterResult =
            fetchPolicy === "cache-only" ? new Date(dateFromCache)
            : fetchPolicy === "no-cache" ? dateFromNetwork
            : new Date(dateFromNetwork);

          if (adjustedCount === 1) {
            expect(result.loading).toBe(true);
            expect(result.data).toEqual({
              date: new Date(dateFromCache),
            });
          } else if (adjustedCount === 2) {
            expect(result.loading).toBe(false);
            expect(result.data).toEqual({
              date: expectedDateAfterResult,
              // The no-cache fetch policy does return extraneous fields from the
              // raw network result that were not requested in the query, since
              // the cache is not consulted.
              ...(fetchPolicy === "no-cache" ?
                {
                  ignored: "irrelevant to the subscribed query",
                }
              : null),
            });

            if (fetchPolicy === "no-cache") {
              // The "no-cache" fetch policy does not receive updates from the
              // cache, so we finish the test early (passing).
              setTimeout(() => resolve(), 20);
            } else {
              cache.writeQuery({
                query: gql`
                  query {
                    missing
                  }
                `,
                data: {
                  missing: "not missing anymore",
                },
              });
            }
          } else if (adjustedCount === 3) {
            expect(result.loading).toBe(false);
            expect(result.data).toEqual({
              date: expectedDateAfterResult,
              missing: "not missing anymore",
            });

            expect(cache.extract()).toEqual({
              ROOT_QUERY: {
                __typename: "Query",
                // The cache-only fetch policy does not receive updates from the
                // network, so it never ends up writing the date field into the
                // cache explicitly, though Query.date can still be synthesized by
                // the read function.
                ...(fetchPolicy === "cache-only" ? null : (
                  {
                    // Make sure this field is stored internally as a raw string.
                    date: dateFromNetwork,
                  }
                )),
                // Written explicitly with cache.writeQuery above.
                missing: "not missing anymore",
                // The ignored field is never written to the cache, because it is
                // not included in the query.
              },
            });

            // Wait 20ms to give the test a chance to fail if there are unexpected
            // additional results.
            setTimeout(() => resolve(), 20);
          } else {
            reject(new Error(`Unexpected count ${adjustedCount}`));
          }
        });
      });
    }
  );
});
