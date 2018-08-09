import { RecordingCache } from '../recordingCache';
import { NormalizedCacheObject } from '../types';

describe('RecordingCache', () => {
  describe('returns correct values during recording', () => {
    const data = {
      Human: { __typename: 'Human', name: 'Mark' },
      Animal: { __typename: 'Mouse', name: '🐭' },
    };
    const dataToRecord = { Human: { __typename: 'Human', name: 'John' } };
    let cache: RecordingCache;

    beforeEach(() => {
      cache = new RecordingCache({ ...data });
    });

    it('should passthrough values if not defined in recording', () => {
      cache.record(() => {
        expect(cache.get('Human')).toBe(data.Human);
        expect(cache.get('Animal')).toBe(data.Animal);
      });
    });

    it('should return values defined during recording', () => {
      const recording = cache.record(() => {
        cache.set('Human', dataToRecord.Human);
        expect(cache.get('Human')).toBe(dataToRecord.Human);
      });
      expect(recording.Human).toBe(dataToRecord.Human);
    });

    it('should return undefined for values deleted during recording', () => {
      const recording = cache.record(() => {
        expect(cache.get('Animal')).toBe(data.Animal);
        // delete should be registered in the recording:
        cache.delete('Animal');
        expect(cache.get('Animal')).toBeUndefined();
      });

      expect(recording).toHaveProperty('Animal');
    });
  });

  describe('returns correct result of a recorded transaction', () => {
    const data = {
      Human: { __typename: 'Human', name: 'Mark' },
      Animal: { __typename: 'Mouse', name: '🐭' },
    };
    const dataToRecord = { Human: { __typename: 'Human', name: 'John' } };
    let cache: RecordingCache;
    let recording: NormalizedCacheObject;

    beforeEach(() => {
      cache = new RecordingCache({ ...data });
      recording = cache.record(() => {
        cache.set('Human', dataToRecord.Human);
        cache.delete('Animal');
      });
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
      expect(cache.toObject()).toEqual(data);
    });
  });
});
