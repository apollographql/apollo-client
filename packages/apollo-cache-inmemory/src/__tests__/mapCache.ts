jest.mock('../entityCache', () => {
  const { MapCache, mapNormalizedCacheFactory } = require('../mapCache');
  return {
    ObjectCache: MapCache,
    defaultNormalizedCacheFactory: mapNormalizedCacheFactory,
    supportsResultCaching() {
      return false;
    },
  };
});

describe('MapCache', () => {
  // simply re-runs all the tests
  // with the alternative implementation of the cache
  require('./cache');
  require('./diffAgainstStore');
  require('./fragmentMatcher');
  require('./readFromStore');
  require('./diffAgainstStore');
  require('./roundtrip');
  require('./writeToStore');
});
