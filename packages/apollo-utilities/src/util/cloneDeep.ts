import fclone from 'fclone';

/**
 * Deeply clones a value to create a new instance.
 */
export function cloneDeep<T>(value: T): T {
  return fclone(value);
}
