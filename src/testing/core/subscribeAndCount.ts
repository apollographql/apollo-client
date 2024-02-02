import type {
  ObservableSubscription,
  Observable,
} from "../../utilities/index.js";
import { asyncMap } from "../../utilities/index.js";

export default function subscribeAndCount<TResult>(
  reject: (reason: any) => any,
  observable: Observable<TResult>,
  cb: (handleCount: number, result: TResult) => any
): ObservableSubscription {
  // Use a Promise queue to prevent callbacks from being run out of order.
  let queue = Promise.resolve();
  let handleCount = 0;

  const subscription = asyncMap(observable, (result) => {
    // All previous asynchronous callbacks must complete before cb can
    // be invoked with this result.
    return (queue = queue
      .then(() => {
        return cb(++handleCount, result);
      })
      .catch(error));
  }).subscribe({ error });

  function error(e: any) {
    subscription.unsubscribe();
    reject(e);
  }

  return subscription;
}
