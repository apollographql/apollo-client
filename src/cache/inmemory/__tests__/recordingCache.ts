import { NormalizedCacheObject } from '../types';
import { EntityStore } from '../entityStore';

describe('Optimistic EntityStore layering', () => {
  function makeLayer(root: EntityStore) {
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

    const underlyingStore = new EntityStore.Root({ seed: data });

    let store = makeLayer(underlyingStore);
    beforeEach(() => {
      store = makeLayer(underlyingStore);
    });

    it('should passthrough values if not defined in recording', () => {
      expect(store.get('Human')).toBe(data.Human);
      expect(store.get('Animal')).toBe(data.Animal);
    });

    it('should return values defined during recording', () => {
      store.merge('Human', dataToRecord.Human);
      expect(store.get('Human')).toEqual(dataToRecord.Human);
      expect(underlyingStore.get('Human')).toBe(data.Human);
    });

    it('should return undefined for values deleted during recording', () => {
      expect(store.get('Animal')).toBe(data.Animal);
      // delete should be registered in the recording:
      store.delete('Animal');
      expect(store.get('Animal')).toBeUndefined();
      expect(store.toObject()).toHaveProperty('Animal');
      expect(underlyingStore.get('Animal')).toBe(data.Animal);
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

    const underlyingStore = new EntityStore.Root({ seed: data });
    let store = makeLayer(underlyingStore);
    let recording: NormalizedCacheObject;

    beforeEach(() => {
      store = makeLayer(underlyingStore);
      store.merge('Human', dataToRecord.Human);
      store.delete('Animal');
      recording = store.toObject();
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
      expect(underlyingStore.toObject()).toEqual(data);
    });
  });
});
