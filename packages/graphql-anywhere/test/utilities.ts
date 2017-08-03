import * as chai from 'chai';
const { assert } = chai;
import gql from 'graphql-tag';

import { filter, check } from '../src/utilities';

describe('utilities', () => {
  describe('with a single query', () => {
    const doc = gql`
      {
        alias: name
        height(unit: METERS)
        avatar {
          square
        }
      }
    `;
    const data = {
      alias: 'Bob',
      name: 'Wrong',
      height: 1.89,
      avatar: {
        square: 'abc',
        circle: 'def',
        triangle: 'qwe',
      },
    };
    const filteredData = {
      alias: 'Bob',
      height: 1.89,
      avatar: {
        square: 'abc',
      },
    };

    it('can filter data', () => {
      assert.deepEqual(filter(doc, data), filteredData);
    });

    it('can check matching data', () => {
      check(doc, filteredData);
    });

    // This doesn't throw but potentially it should?
    it('can check overspecified data', () => {
      check(doc, data);
    });

    it('throws when checking underspecified data', () => {
      assert.throws(() => {
        check(doc, {
          name: 'Wrong',
        });
      });

      assert.throws(() => {
        check(doc, {
          alias: 'Bob',
          height: 1.89,
        });
      });
    });
  });

  describe('with a single fragment', () => {
    const doc = gql`
      fragment PersonDetails on Person {
        alias: name
        height(unit: METERS)
        avatar {
          square
        }
      }
    `;
    const data = {
      alias: 'Bob',
      name: 'Wrong',
      height: 1.89,
      avatar: {
        square: 'abc',
        circle: 'def',
        triangle: 'qwe',
      },
    };
    const filteredData = {
      alias: 'Bob',
      height: 1.89,
      avatar: {
        square: 'abc',
      },
    };

    it('can filter data', () => {
      assert.deepEqual(filter(doc, data), filteredData);
    });

    it('can check matching data', () => {
      check(doc, filteredData);
    });

    // This doesn't throw but potentially it should?
    it('can check overspecified data', () => {
      check(doc, data);
    });

    it('throws when checking underspecified data', () => {
      assert.throws(() => {
        check(doc, {
          name: 'Wrong',
        });
      });

      assert.throws(() => {
        check(doc, {
          alias: 'Bob',
          height: 1.89,
        });
      });
    });
  });

  describe('with a single fragment', () => {
    const doc = gql`
      fragment PersonDetails on Person {
        alias: name
        height(unit: METERS)
        avatar {
          square
        }
      }
    `;
    const data = {
      alias: 'Bob',
      name: 'Wrong',
      height: 1.89,
      avatar: {
        square: 'abc',
        circle: 'def',
        triangle: 'qwe',
      },
    };
    const filteredData = {
      alias: 'Bob',
      height: 1.89,
      avatar: {
        square: 'abc',
      },
    };

    it('can filter data', () => {
      assert.deepEqual(filter(doc, data), filteredData);
    });

    it('can check matching data', () => {
      check(doc, filteredData);
    });

    // This doesn't throw but potentially it should?
    it('can check overspecified data', () => {
      check(doc, data);
    });

    it('throws when checking underspecified data', () => {
      assert.throws(() => {
        check(doc, {
          name: 'Wrong',
        });
      });

      assert.throws(() => {
        check(doc, {
          alias: 'Bob',
          height: 1.89,
        });
      });
    });
  });

  describe('with nested fragments', () => {
    const doc = gql`
      fragment PersonDetails on Person {
        alias: name
        height(unit: METERS)
        avatar {
          square
          ... on Avatar {
            circle
          }
        }
      }
    `;
    const data = {
      alias: 'Bob',
      name: 'Wrong',
      height: 1.89,
      avatar: {
        square: 'abc',
        circle: 'def',
        triangle: 'qwe',
      },
    };
    const filteredData = {
      alias: 'Bob',
      height: 1.89,
      avatar: {
        square: 'abc',
        circle: 'def',
      },
    };

    it('can filter data', () => {
      assert.deepEqual(filter(doc, data), filteredData);
    });

    it('can check matching data', () => {
      check(doc, filteredData);
    });

    // This doesn't throw but potentially it should?
    it('can check overspecified data', () => {
      check(doc, data);
    });

    it('throws when checking underspecified data', () => {
      assert.throws(() => {
        check(doc, {
          name: 'Wrong',
        });
      });

      assert.throws(() => {
        check(doc, {
          alias: 'Bob',
          height: 1.89,
        });
      });

      assert.throws(() => {
        check(doc, {
          alias: 'Bob',
          height: 1.89,
          avatar: {
            // missing the correct field
            triangle: 'qwe',
          },
        });
      });
    });

    describe('if the nested fragment has not matched', () => {
      it('can filter data', () => {
        const filtered = filter(doc, {
          alias: 'Bob',
          name: 'Wrong',
          height: 1.89,
          avatar: {
            square: 'abc',
            // there is no circle field here, but we can't know if that's not
            // because avatar is not an Avatar
            triangle: 'qwe',
          },
        });

        assert.deepEqual(filtered, {
          alias: 'Bob',
          height: 1.89,
          avatar: {
            square: 'abc',
          },
        });
      });

      it('does not throw when checking', () => {
        check(doc, {
          alias: 'Wrong',
          height: 1.89,
          avatar: {
            square: 'abc',
            // there is no circle field here, but we can't know if that's not
            // because avatar is not an Avatar
          },
        });
      });
    });
  });
});
