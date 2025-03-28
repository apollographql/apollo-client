/**
 * Deeply clones a value to create a new instance.
 */
export function cloneDeep<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}
