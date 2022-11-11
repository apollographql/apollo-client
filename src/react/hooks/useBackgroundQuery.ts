import React, { useEffect } from "react";
// import { unstable_batchedUpdates } from "react-dom";
import equal from "@wry/equality";

import { WatchQueryOptions, ObservableQuery } from "../../core";

import {
  // getMainDefinition,
  getFragmentDefinitions,
  DeepMerger,
  ReconcilerFunction,
} from "../../utilities";
import { useApolloClient } from "./useApolloClient";
// import { useReactiveVar } from "./useReactiveVar";

export const NON_REACTIVE_DIRECTIVE = "nonreactive";

// todo: throw dev-only warning if useFragment is called with an unregistered
// fragment? or at least one that is not in the query document?

/* so ultimately, the useBackgroundQuery hook implementation will at some point
   call observable.subscribe({ next(result) {...}}), and that ... logic is
   where you could decide when/whether to trigger a rerender or just swallow
   the update

   right now it updates the dataVar reactive variable and never directly
   triggers a rerender (edited)

   instead, that logic could examine the new result together with the previous
   result, specifically ignoring any @nonreactive parts of the results, and
   only trigger React rerendering if there are changes outside of those parts

   so I think the logic could be fairly localized within useBackgroundQuery

   we still have all the questions about exactly what to pass down to child
   components as props (conveying variables etc) but I think this might let us
   do everything the parent needs in one useBackgroundQuery, hopefully
*/

type TypesAndFieldsMap = Map<string, string[]>;

export function useBackgroundQuery_experimental<TData, TVars>(
  options: WatchQueryOptions<TVars, TData>
): UseBackgroundQueryResult<TData, TVars> {
  const client = useApolloClient();
  const observable = client.watchQuery(options);
  const [data, setData] = React.useState<TData>();
  const { query } = options;
  const fragments = React.useMemo(() => getFragmentDefinitions(query), [query]);
  // const mainDefinition = React.useMemo(() => getMainDefinition(query), [query]);
  // console.log(JSON.stringify(mainDefinition, null, 2));

  const useData = () => React.useMemo(() => data, [data]);

  const nonReactiveFields = React.useMemo(() => {
    const typesAndFields: TypesAndFieldsMap = new Map();

    fragments.forEach((fragment) => {
      if (
        fragment.directives?.find(
          (node) => node.name.value === NON_REACTIVE_DIRECTIVE
        )
      ) {
        if (typesAndFields.has(fragment.name.value)) {
          // to do: determine how to proceed
          // if the fragment definition is a duplicate
        } else {
          const fieldsToIgnore = new Set<string>();
          fragment.selectionSet.selections.forEach((selection) => {
            if ("name" in selection) {
              fieldsToIgnore.add(selection.name.value);
            }
          });
          // to do: determine if `fragment.typeCondition.name.value` is the
          // value I want in every case here or if there are edge cases
          typesAndFields.set(
            fragment.typeCondition.name.value,
            Array.from(fieldsToIgnore)
          );
        }
      }
    });
    return typesAndFields;
  }, [fragments, NON_REACTIVE_DIRECTIVE]);

  useEffect(() => {
    const sub = observable.subscribe({
      next(result) {
        if (!data) {
          setData(result.data);
        } else {
          // diff result.data with data
          // diffData(nonReactiveFields, data, result.data);
          const reconciler: ReconcilerFunction<any[]> = function (
            target,
            source,
            property
          ) {
            if (
              source.__typename &&
              nonReactiveFields
                .get(source.__typename)
                ?.includes(property.toString())
            ) {
              // return the old property
              return target[property];
            } else {
              return this.merge(target[property], source[property]);
            }
          };
          const missingMerger = new DeepMerger(reconciler);
          // todo: deep clone data before merging?
          const mergedData = missingMerger.merge(data, result.data);
          if (!equal(mergedData, data)) {
            console.log("SET DATA");
            setData(mergedData);
          }
        }
      },

      error(error) {
        // unstable_batchedUpdates(() => {
        //   state.loadingVar(false);
        //   state.networkStatusVar(NetworkStatus.error);
        //   state.errorVar(error);
        //   // Intentionally not clearing state.dataVar, since it may still be
        //   // useful even though there's been an error.
        //   // state.dataVar(void 0);
        // });
      },
    });

    return () => sub.unsubscribe();
  }, [observable, data, nonReactiveFields]);

  return { useData, observable };
}

export interface UseBackgroundQueryResult<TData, TVars> {
  // By returning hook functions that the component can choose to call (or not),
  // useBackgroundQuery is technically a "higher-order hook," in the same way a
  // function that returns other functions is a higher-order function.
  // useLoading(): boolean;
  // useNetworkStatus(): NetworkStatus;
  // useError(): ApolloError | undefined;
  observable: ObservableQuery<TData, TVars>;
  useData(): TData | undefined;
}

// interface InternalState<TData, TVars>
//   extends UseBackgroundQueryResult<TData, TVars> {
//   options: WatchQueryOptions<TVars, TData>;
//   loadingVar: ReactiveVar<boolean>;
//   networkStatusVar: ReactiveVar<NetworkStatus>;
//   errorVar: ReactiveVar<ApolloError | undefined>;
//   dataVar: ReactiveVar<TData | undefined>;
// }

// function useInternalState<TData, TVars>(
//   queryOrOptions:
//     | ObservableQuery<TData, TVars>
//     | WatchQueryOptions<TVars, TData>
// ): InternalState<TData, TVars> {
//   const client = useApolloClient();
//   const ref = useRef<InternalState<TData, TVars>>();
//   return (
//     ref.current ||
//     (ref.current = internalStateFromOptions(client, queryOrOptions))
//   );
// }

// function makeSharedVars<TData, TVars>(
//   observable: ObservableQuery<TData, TVars>
// ) {
//   const result = observable.getCurrentResult();
//   const loadingVar = makeVar(result.loading);
//   const networkStatusVar = makeVar(result.networkStatus);
//   const errorVar = makeVar(result.error);
//   const dataVar = makeVar(result.data);

//   return {
//     loadingVar,
//     networkStatusVar,
//     errorVar,
//     dataVar,

//     useLoading: () => useReactiveVar(loadingVar),
//     useNetworkStatus: () => useReactiveVar(networkStatusVar),
//     useError: () => useReactiveVar(errorVar),
//     useData: () => useReactiveVar(dataVar),
//   };
// }

// function internalStateFromOptions<TData, TVars>(
//   client: ReturnType<typeof useApolloClient>,
//   options: WatchQueryOptions<TVars, TData>
// ): InternalState<TData, TVars> {
//   const observable = client.watchQuery(options);
//   return Object.assign(makeSharedVars(observable), {
//     observable,
//     options,
//   });
// }
