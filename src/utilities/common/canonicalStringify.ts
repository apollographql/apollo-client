// Like JSON.stringify, but with object keys always sorted in the same order.
export const canonicalStringify = Object.assign(
  function canonicalStringify(value: any): string {
    return JSON.stringify(value, stableObjectReplacer);
  },
  {
    reset() {
      // TODO
    },
  }
);

// The JSON.stringify function takes an optional second argument called a
// replacer function. This function is called for each key-value pair in the
// object being stringified, and its return value is used instead of the
// original value. If the replacer function returns a new value, that value is
// stringified as JSON instead of the original value of the property.
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#the_replacer_parameter
function stableObjectReplacer(key: string, value: any) {
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    // We don't want to mess with objects that are not "plain" objects, which
    // means their prototype is either Object.prototype or null.
    if (proto === Object.prototype || proto === null) {
      const sorted = Object.create(null);
      // TODO This sorting step can be sped up in two ways:
      // 1. If the keys are already sorted, we can skip the sorting step.
      // 2. If we have sorted this sequence of keys before, we can look up the
      //    previously sorted sequence in linear time rather than O(n log n)
      //    time, which is the typical cost of sorting.
      Object.keys(value)
        .sort()
        .forEach((key) => {
          sorted[key] = value[key];
        });
      return sorted;
    }
  }
  return value;
}
