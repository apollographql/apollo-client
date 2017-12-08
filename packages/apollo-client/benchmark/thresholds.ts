export const thresholds: { [name: string]: number } = {
  'constructing an instance': 0.01,

  'fetching a query result from mocked server': 1.7,

  'write data and receive update from the cache': 1.6,
  'write data and deliver update to 5 subscribers': 2.5,
  'write data and deliver update to 10 subscribers': 3.0,
  'write data and deliver update to 20 subscribers': 3.9,
  'write data and deliver update to 40 subscribers': 6.8,
  'write data and deliver update to 80 subscribers': 13.1,
  'write data and deliver update to 160 subscribers': 23.5,
  'write data and deliver update to 320 subscribers': 47.5,

  'read single item from cache with 5 items in cache': 0.8,
  'read single item from cache with 10 items in cache': 0.8,
  'read single item from cache with 20 items in cache': 0.8,
  'read single item from cache with 40 items in cache': 0.8,
  'read single item from cache with 80 items in cache': 0.8,
  'read single item from cache with 160 items in cache': 0.9,
  'read single item from cache with 320 items in cache': 1.0,

  'read result with 5 items associated with the result': 0.8,
  'read result with 10 items associated with the result': 0.8,
  'read result with 20 items associated with the result': 0.9,
  'read result with 40 items associated with the result': 1.1,
  'read result with 80 items associated with the result': 1.4,
  'read result with 160 items associated with the result': 2.2,
  'read result with 320 items associated with the result': 3.8,

  'diff query against store with 5 items': 0.03,
  'diff query against store with 10 items': 0.04,
  'diff query against store with 20 items': 0.07,
  'diff query against store with 40 items': 0.15,
  'diff query against store with 80 items': 0.2,
  'diff query against store with 160 items': 0.4,
  'diff query against store with 320 items': 0.8,
};
