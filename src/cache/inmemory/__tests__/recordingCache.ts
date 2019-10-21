import { NormalizedCacheObject } from '../types';
import { EntityCache } from '../entityCache';

describe('OptimisticCacheLayer', () => {
  function makeLayer(root: EntityCache) {
    return root.addLayer('whatever', () => {});
  }

  describe('returns correct values during recording', () => {
    const data = {
      Human: { __typename: 'Human', name: 'Mark' },
      Animal: { __typename: 'Mouse', name: '🐭' },
    };

    const dataToRecord = {
      Human: { __typename: 'Human', name: 'John' },
    };

    const underlyingCache = new EntityCache.Root({ seed: data });

    let cache: EntityCache;
    beforeEach(async () => {
      cache = await makeLayer(underlyingCache);
    });

    it('should passthrough values if not defined in recording', () => {
      expect(cache.get('Human')).toBe(data.Human);
      expect(cache.get('Animal')).toBe(data.Animal);
    });

    it('should return values defined during recording', () => {
      cache.set('Human', dataToRecord.Human);
      expect(cache.get('Human')).toBe(dataToRecord.Human);
      expect(underlyingCache.get('Human')).toBe(data.Human);
    });

    it('should return undefined for values deleted during recording', () => {
      expect(cache.get('Animal')).toBe(data.Animal);
      // delete should be registered in the recording:
      cache.delete('Animal');
      expect(cache.get('Animal')).toBeUndefined();
      expect(cache.toObject()).toHaveProperty('Animal');
      expect(underlyingCache.get('Animal')).toBe(data.Animal);
    });
  });

  describe('returns correct result of a recorded transaction', () => {
    const data = {
      Human: { __typename: 'Human', name: 'Mark' },
      Animal: { __typename: 'Mouse', name: '🐭' },
    };

    const dataToRecord = {
      Human: { __typename: 'Human', name: 'John' },
    };

    const underlyingCache = new EntityCache.Root({ seed: data });
    let cache: EntityCache;
    let recording: NormalizedCacheObject;

    beforeEach(async () => {
      cache = await makeLayer(underlyingCache);
      cache.set('Human', dataToRecord.Human);
      cache.delete('Animal');
      recording = cache.toObject();
    });

    it('should contain the property indicating deletion', () => {
      expect(recording).toHaveProperty('Animal');
    });

    it('should have recorded the changes made during recording', () => {
      expect(recording).toEqual({
        Human: dataToRecord.Human,
        Animal: undefined,
      });
    });

    it('should keep the original data unaffected', () => {
      expect(underlyingCache.toObject()).toEqual(data);
    });
  });
});
