export const thresholds: { [name: string]: number } = {
  'constructing an instance': 0.1,

  'fetching a query result from mocked server': 14,

  'write data and receive update from the cache': 14,
  'write data and deliver update to 5 subscribers': 20,
  'write data and deliver update to 10 subscribers': 25,
  'write data and deliver update to 20 subscribers': 40,
  'write data and deliver update to 40 subscribers': 62,
  'write data and deliver update to 80 subscribers': 100,
  'write data and deliver update to 160 subscribers': 165,
  'write data and deliver update to 320 subscribers': 430,

  'read single item from cache with 5 items in cache': 0.65 / 0.062,
  'read single item from cache with 10 items in cache': 0.65 / 0.062,
  'read single item from cache with 20 items in cache': 0.65 / 0.062,
  'read single item from cache with 40 items in cache': 0.65 / 0.062,
  'read single item from cache with 80 items in cache': 0.65 / 0.062,
  'read single item from cache with 160 items in cache': 0.65 / 0.062,
  'read single item from cache with 320 items in cache': 0.65 / 0.062,

  'read result with 5 items associated with the result': 0.8 / 0.062,
  'read result with 10 items associated with the result': 0.8 / 0.062,
  'read result with 20 items associated with the result': 0.8 / 0.062,
  'read result with 40 items associated with the result': 1 / 0.062,
  'read result with 80 items associated with the result': 1.3 / 0.062,
  'read result with 160 items associated with the result': 2.1 / 0.062,
  'read result with 320 items associated with the result': 3.6 / 0.062,

  'diff query against store with 5 items': 0.06 / 0.062,
  'diff query against store with 10 items': 0.07 / 0.062,
  'diff query against store with 20 items': 0.07 / 0.062,
  'diff query against store with 40 items': 0.11 / 0.062,
  'diff query against store with 80 items': 0.2 / 0.062,
  'diff query against store with 160 items': 0.36 / 0.062,
  'diff query against store with 320 items': 0.75 / 0.062,
};
