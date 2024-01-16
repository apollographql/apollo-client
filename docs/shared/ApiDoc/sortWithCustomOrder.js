/**
 * Sorts items by their `displayName` with a custom order:
 * - items within the `customOrder` array will be sorted to the start,
 *   sorted by the order of the `customOrder` array
 * - items not in the `customOrder` array will be sorted in lexicographical order after that
 * - deprecated items will be sorted in lexicographical order to the end
 */
export function sortWithCustomOrder(customOrder = []) {
  return (a, b) => {
    let aIndex = customOrder.indexOf(a.displayName);
    if (aIndex == -1) {
      aIndex =
        a.comment?.deprecated ?
          Number.MAX_SAFE_INTEGER
        : Number.MAX_SAFE_INTEGER - 1;
    }
    let bIndex = customOrder.indexOf(b.displayName);
    if (bIndex == -1) {
      bIndex =
        b.comment?.deprecated ?
          Number.MAX_SAFE_INTEGER
        : Number.MAX_SAFE_INTEGER - 1;
    }
    if (aIndex === bIndex) {
      return a.displayName.localeCompare(b.displayName);
    } else {
      return aIndex - bIndex;
    }
  };
}
