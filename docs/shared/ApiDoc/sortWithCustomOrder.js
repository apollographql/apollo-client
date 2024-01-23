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
      return sortLocally(a.displayName, b.displayName);
    } else {
      return aIndex - bIndex;
    }
  };
}

function sortLocally(a, b) {
  return a.localeCompare(b);
}

/**
 *
 * @param {Array<{displayName: string, comment: { docGroup: string }}>} items
 * @param {string[]} customOrder
 */
export function groupItems(items = [], customOrder = []) {
  const customItems = [];
  const groupedItems = [];
  for (const item of items) {
    if (customOrder.includes(item.displayName)) customItems.push(item);
    else groupedItems.push(item);
  }
  customItems.sort(sortWithCustomOrder(customOrder));
  const groupNames = [
    ...new Set(groupedItems.map((item) => item.comment?.docGroup || "Other")),
  ].sort(sortLocally);
  const groups = Object.fromEntries(groupNames.map((name) => [name, []]));
  for (const item of groupedItems) {
    groups[item.comment?.docGroup || "Other"].push(item);
  }
  for (const group of Object.values(groups)) {
    group.sort(sortWithCustomOrder([]));
  }
  const groupsWithoutPrefix = Object.fromEntries(
    Object.entries(groups).map(([name, items]) => [
      name.replace(/^\s*\d*\.\s*/, ""),
      items,
    ])
  );
  return customItems.length === 0 ?
      groupsWithoutPrefix
    : {
        "": customItems,
        ...groupsWithoutPrefix,
      };
}
