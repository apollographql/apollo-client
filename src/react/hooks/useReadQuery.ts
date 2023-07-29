import * as React from 'react';
import {
  unwrapQueryRef,
  type QueryReference,
} from '../cache/QueryReference.js';
import { __use } from './internal/index.js';
import { toApolloError } from './useSuspenseQuery.js';
import { invariant } from '../../utilities/globals/index.js';

export function useReadQuery<TData>(queryRef: QueryReference<TData>) {
  const [, forceUpdate] = React.useState(0);
  const internalQueryRef = unwrapQueryRef(queryRef);
  invariant(
    internalQueryRef.promiseCache,
    'It appears that `useReadQuery` was used outside of `useBackgroundQuery`. ' +
      '`useReadQuery` is only supported for use with `useBackgroundQuery`. ' +
      'Please ensure you are passing the `queryRef` returned from `useBackgroundQuery`.'
  );

  let promise = internalQueryRef.promiseCache.get(internalQueryRef.key);

  if (!promise) {
    promise = internalQueryRef.promise;
    internalQueryRef.promiseCache.set(internalQueryRef.key, promise);
  }

  React.useEffect(() => {
    return internalQueryRef.listen((promise) => {
      internalQueryRef.promiseCache!.set(internalQueryRef.key, promise);
      forceUpdate((prevState) => prevState + 1);
    });
  }, [queryRef]);

  const result = __use(promise);

  return React.useMemo(() => {
    return {
      data: result.data,
      networkStatus: result.networkStatus,
      error: toApolloError(result),
    };
  }, [result]);
}
