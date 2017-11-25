export const thresholds: { [name: string]: number } = {
  'constructing an instance': 0.01,

  'fetching a query result from mocked server': 2.5,

  'write data and receive update from the cache': 2.5,
  'write data and deliver update to 5 subscribers': 3,
  'write data and deliver update to 10 subscribers': 3.2,
  'write data and deliver update to 20 subscribers': 4,
  'write data and deliver update to 40 subscribers': 5.75,
  'write data and deliver update to 80 subscribers': 8.75,
  'write data and deliver update to 160 subscribers': 15,
  'write data and deliver update to 320 subscribers': 29,

  'read single item from cache with 5 items in cache': 0.75,
  'read single item from cache with 10 items in cache': 0.75,
  'read single item from cache with 20 items in cache': 0.75,
  'read single item from cache with 40 items in cache': 0.75,
  'read single item from cache with 80 items in cache': 0.75,
  'read single item from cache with 160 items in cache': 0.75,
  'read single item from cache with 320 items in cache': 0.75,

  'read result with 5 items associated with the result': 0.75,
  'read result with 10 items associated with the result': 0.75,
  'read result with 20 items associated with the result': 0.75,
  'read result with 40 items associated with the result': 1,
  'read result with 80 items associated with the result': 1,
  'read result with 160 items associated with the result': 1.5,
  'read result with 320 items associated with the result': 2.5,

  'diff query against store with 5 items': 0.05,
  'diff query against store with 10 items': 0.05,
  'diff query against store with 20 items': 0.05,
  'diff query against store with 40 items': 0.1,
  'diff query against store with 80 items': 0.15,
  'diff query against store with 160 items': 0.25,
  'diff query against store with 320 items': 0.5,
};
