const { hasOwnProperty } = Object.prototype;

// These mergeDeep and mergeDeepArray utilities merge any number of objects
// together, sharing as much memory as possible with the source objects, while
// remaining careful to avoid modifying any source objects.

export function mergeDeep(...sources: any[]) {
  return mergeDeepArray(sources);
}

export function mergeDeepArray(sources: any[]) {
  let target = sources[0] || {};
  const count = sources.length;
  if (count > 1) {
    const pastCopies: any[] = [];
    target = shallowCopyForMerge(target, pastCopies);
    for (let i = 1; i < count; ++i) {
      target = mergeHelper(target, sources[i], pastCopies);
    }
  }
  return target;
}

function isObject(obj: any): obj is Record<string | number, any> {
  return obj !== null && typeof obj === 'object';
}

function mergeHelper(
  target: Record<string, any>,
  source: Record<string, any>,
  pastCopies: any[],
) {
  if (isObject(source) && isObject(target)) {
    // In case the target has been frozen, make an extensible copy so that
    // we can merge properties into the copy.
    if (Object.isExtensible && !Object.isExtensible(target)) {
      target = shallowCopyForMerge(target, pastCopies);
    }

    Object.keys(source).forEach(sourceKey => {
      const sourceValue = source[sourceKey];
      if (hasOwnProperty.call(target, sourceKey)) {
        const targetValue = target[sourceKey];
        if (sourceValue !== targetValue) {
          // When there is a key collision, we need to make a shallow copy of
          // target[sourceKey] so the merge does not modify any source objects.
          // To avoid making unnecessary copies, we use a simple array to track
          // past copies, since it's safe to modify copies created earlier in
          // the merge. We use an array for pastCopies instead of a Map or Set,
          // since the number of copies should be relatively small, and some
          // Map/Set polyfills modify their keys.
          target[sourceKey] = mergeHelper(
            shallowCopyForMerge(targetValue, pastCopies),
            sourceValue,
            pastCopies,
          );
        }
      } else {
        // If there is no collision, the target can safely share memory with
        // the source, and the recursion can terminate here.
        target[sourceKey] = sourceValue;
      }
    });

    return target;
  }

  // If source (or target) is not an object, let source replace target.
  return source;
}

function shallowCopyForMerge<T>(value: T, pastCopies: any[]): T {
  if (
    value !== null &&
    typeof value === 'object' &&
    pastCopies.indexOf(value) < 0
  ) {
    if (Array.isArray(value)) {
      value = (value as any).slice(0);
    } else {
      value = { ...(value as any) };
    }
    pastCopies.push(value);
  }
  return value;
}
