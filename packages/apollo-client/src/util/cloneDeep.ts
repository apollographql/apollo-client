/**
 * Deeply clones a value to create a new instance.
 */
export function cloneDeep<T>(value: T): T {
  // If the value is an array, create a new array where every item has been cloned.
  if (Array.isArray(value)) {
    return value.map(item => cloneDeep(item)) as any;
  }
  // If the value is an object, go through all of the object’s properties and add them to a new
  // object.
  if (value !== null && typeof value === 'object') {
    const nextValue: any = {};
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        nextValue[key] = cloneDeep(value[key]);
      }
    }
    return nextValue;
  }
  // Otherwise this is some primitive value and it is therefore immutable so we can just return it
  // directly.
  return value;
}
