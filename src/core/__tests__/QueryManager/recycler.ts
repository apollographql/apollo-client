/*
 * This test is used to verify the requirements for how react-apollo
 * preserves observables using QueryRecycler. Eventually, QueryRecycler
 * will be removed, but this test file should still be valid
 */

// externals
import gql from "graphql-tag";

// core
import { QueryManager } from "../../QueryManager";
import { ObservableQuery } from "../../ObservableQuery";
import { ObservableSubscription } from "../../../utilities";
import { itAsync } from "../../../testing";
import { InMemoryCache } from "../../../cache";

// mocks
import { MockSubscriptionLink } from "../../../testing/core";
import { getDefaultOptionsForQueryManagerTests } from "../../../testing/core/mocking/mockQueryManager";

describe("Subscription lifecycles", () => {
  itAsync(
    "cleans up and reuses data like QueryRecycler wants",
    (resolve, reject) => {
      const query = gql`
        query Luke {
          people_one(id: 1) {
            name
            friends {
              name
            }
          }
        }
      `;

      const initialData = {
        people_one: {
          name: "Luke Skywalker",
          friends: [{ name: "Leia Skywalker" }],
        },
      };

      const link = new MockSubscriptionLink();
      const queryManager = new QueryManager(
        getDefaultOptionsForQueryManagerTests({
          cache: new InMemoryCache({ addTypename: false }),
          link,
        })
      );

      // step 1, get some data
      const observable = queryManager.watchQuery<any>({
        query,
        variables: {},
        fetchPolicy: "cache-and-network",
      });

      const observableQueries: Array<{
        observableQuery: ObservableQuery;
        subscription: ObservableSubscription;
      }> = [];

      const resubscribe = () => {
        const { observableQuery, subscription } = observableQueries.pop()!;
        subscription.unsubscribe();

        observableQuery.setOptions({
          query,
          fetchPolicy: "cache-and-network",
        });

        return observableQuery;
      };

      const sub = observable.subscribe({
        next(result: any) {
          expect(result.loading).toBe(false);
          expect(result.data).toEqual(initialData);
          expect(observable.getCurrentResult().data).toEqual(initialData);

          // step 2, recycle it
          observable.setOptions({
            fetchPolicy: "standby",
            pollInterval: 0,
          });

          observableQueries.push({
            observableQuery: observable,
            subscription: observable.subscribe({}),
          });

          // step 3, unsubscribe from observable
          sub.unsubscribe();

          setTimeout(() => {
            // step 4, start new Subscription;
            const recycled = resubscribe();
            const currentResult = recycled.getCurrentResult();
            expect(currentResult.data).toEqual(initialData);
            resolve();
          }, 10);
        },
      });

      setInterval(() => {
        // fire off first result
        link.simulateResult({ result: { data: initialData } });
      }, 10);
    }
  );
});
