import { relayStylePagination } from '../pagination'
import { Reference } from '../../../cache/inmemory/types'
import { InMemoryCache } from '../../../core'

describe('pagination', () => {
  describe('relayStylePagination', () => {
    describe('merge', () => {
      it('returns incoming pageInfo', () => {
        const { merge } = relayStylePagination()
        if (typeof merge !== 'function') {
          throw new Error("Expected merge to be function")
        }

        const incoming = { edges: [], pageInfo: {
          // makeEmptyData has these reversed
          hasPreviousPage: true,
          hasNextPage: false,
          startCursor: "",
          endCursor: ""
        } }

        const options = {
          args: { after: "" },
          fieldName: "",
          storeFieldName: "",
          field: null,
          storage: null,
          isReference: (obj: any): obj is Reference => false,
          toReference: (obj: any): Reference => obj,
          cache: new InMemoryCache(),
          readField: () => {},
          canRead: () => false,
          mergeObjects: () => undefined
        }

        const res = merge(undefined, incoming, options)
        expect(res.pageInfo.hasPreviousPage).toEqual(incoming.pageInfo.hasPreviousPage)
        expect(res.pageInfo.hasNextPage).toEqual(incoming.pageInfo.hasNextPage)
      })
    })
  })
})
