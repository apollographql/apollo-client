import gql, { disableFragmentWarnings } from 'graphql-tag';
import { checkPropTypes } from 'prop-types';

// Turn off warnings for repeated fragment names
disableFragmentWarnings();

import { filter, check, propType } from '../utilities';

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
    const fragment = gql`
      fragment foo on Foo {
        alias: name
        height(unit: METERS)
        avatar {
          square
        }
      }
    `;
    const fragmentWithAVariable = gql`
      fragment foo on Foo {
        alias: name
        height(unit: METERS)
        avatar @include(if: $foo) {
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
    const arrayData = [
      {
        alias: 'Bob',
        name: 'Wrong',
        height: 1.89,
        avatar: {
          square: 'abc',
          circle: 'def',
          triangle: 'qwe',
        },
      },
      {
        alias: 'Tom',
        name: 'Right',
        height: 1.77,
        avatar: {
          square: 'jkl',
          circle: 'bnm',
          triangle: 'uio',
        },
      },
    ];
    const filteredArrayData = [
      {
        alias: 'Bob',
        height: 1.89,
        avatar: {
          square: 'abc',
        },
      },
      {
        alias: 'Tom',
        height: 1.77,
        avatar: {
          square: 'jkl',
        },
      },
    ];

    beforeEach(() => {
      checkPropTypes.resetWarningCache();
      jest.spyOn(global.console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      global.console.error.mockRestore();
    });

    it('can filter data', () => {
      expect(filter(doc, data)).toEqual(filteredData);
    });

    it('can filter an array of data', () => {
      expect(filter(doc, arrayData)).toEqual(filteredArrayData);
    });

    it('can filter data for fragments ', () => {
      expect(filter(fragment, data)).toEqual(filteredData);
    });

    it('can filter data for fragments with variables', () => {
      expect(filter(fragmentWithAVariable, data, { foo: true })).toEqual(
        filteredData,
      );
    });

    it('can generate propTypes for fragments', () => {
      expect(propType(fragment)).toEqual(expect.any(Function));
    });

    it('can check propTypes for fragments', () => {
      const propTypes = {
        foo: propType(fragment),
      };
      checkPropTypes(propTypes, filteredData, 'prop', 'MyComponent');
      expect(global.console.error).not.toHaveBeenCalled();
      checkPropTypes(propTypes, { foo: {} }, 'prop', 'MyComponent');
      expect(global.console.error.mock.calls[0]).toMatchSnapshot();
    });

    it('can generate propTypes for fragments with variables', () => {
      expect(propType(fragmentWithAVariable)).toEqual(expect.any(Function));
    });

    it('can check propTypes for fragments with variables', () => {
      const mapPropsToVariables = () => null;
      const propTypes = {
        foo: propType(fragmentWithAVariable, mapPropsToVariables),
      };
      checkPropTypes(propTypes, { foo: filteredData }, 'prop', 'MyComponent');
      expect(global.console.error).not.toHaveBeenCalled();
      const badProps = { foo: { ...filteredData } };
      delete badProps.foo.height;
      checkPropTypes(propTypes, badProps, 'prop', 'MyComponent');
      expect(global.console.error).toHaveBeenCalled();
      expect(global.console.error.mock.calls[0]).toMatchSnapshot();
    });

    it('makes variable inclusion props optional, when no variables are passed', () => {
      const propTypes = {
        foo: propType(fragmentWithAVariable),
      };
      const propsWithoutAvatar = { foo: { ...filteredData } };
      delete propsWithoutAvatar.foo.avatar;
      checkPropTypes(propTypes, propsWithoutAvatar, 'prop', 'MyComponent');
      expect(global.console.error).not.toHaveBeenCalled();
    });

    it('can check matching data', () => {
      check(doc, filteredData);
    });

    it('can check matching data for fragments with variables', () => {
      check(doc, filteredData, { foo: true });
    });

    it('throws when checking non-matching data for fragments with variables', () => {
      const badFilteredData = { ...filteredData };
      delete badFilteredData.avatar;
      expect(() => {
        check(doc, badFilteredData);
      }).toThrow();
    });

    // This doesn't throw but potentially it should?
    it('can check overspecified data', () => {
      check(doc, data);
    });

    it('throws when checking underspecified data', () => {
      expect(() => {
        check(doc, {
          name: 'Wrong',
        });
      }).toThrow();

      expect(() => {
        check(doc, {
          alias: 'Bob',
          height: 1.89,
        });
      }).toThrow();
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
    const arrayData = [
      {
        alias: 'Bob',
        name: 'Wrong',
        height: 1.89,
        avatar: {
          square: 'abc',
          circle: 'def',
          triangle: 'qwe',
        },
      },
      {
        alias: 'Tom',
        name: 'Right',
        height: 1.77,
        avatar: {
          square: 'jkl',
          circle: 'bnm',
          triangle: 'uio',
        },
      },
    ];
    const filteredArrayData = [
      {
        alias: 'Bob',
        height: 1.89,
        avatar: {
          square: 'abc',
        },
      },
      {
        alias: 'Tom',
        height: 1.77,
        avatar: {
          square: 'jkl',
        },
      },
    ];

    it('can filter data', () => {
      expect(filter(doc, data)).toEqual(filteredData);
    });

    it('can filter an array of data', () => {
      expect(filter(doc, arrayData)).toEqual(filteredArrayData);
    });

    it('can check matching data', () => {
      check(doc, filteredData);
    });

    // This doesn't throw but potentially it should?
    it('can check overspecified data', () => {
      check(doc, data);
    });

    it('throws when checking underspecified data', () => {
      expect(() => {
        check(doc, {
          name: 'Wrong',
        });
      }).toThrow();

      expect(() => {
        check(doc, {
          alias: 'Bob',
          height: 1.89,
        });
      }).toThrow();
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
    const arrayData = [
      {
        alias: 'Bob',
        name: 'Wrong',
        height: 1.89,
        avatar: {
          square: 'abc',
          circle: 'def',
          triangle: 'qwe',
        },
      },
      {
        alias: 'Tom',
        name: 'Right',
        height: 1.77,
        avatar: {
          square: 'jkl',
          circle: 'bnm',
          triangle: 'uio',
        },
      },
    ];
    const filteredArrayData = [
      {
        alias: 'Bob',
        height: 1.89,
        avatar: {
          square: 'abc',
        },
      },
      {
        alias: 'Tom',
        height: 1.77,
        avatar: {
          square: 'jkl',
        },
      },
    ];

    it('can filter data', () => {
      expect(filter(doc, data)).toEqual(filteredData);
    });

    it('can filter an array of data', () => {
      expect(filter(doc, arrayData)).toEqual(filteredArrayData);
    });

    it('can check matching data', () => {
      check(doc, filteredData);
    });

    // This doesn't throw but potentially it should?
    it('can check overspecified data', () => {
      check(doc, data);
    });

    it('throws when checking underspecified data', () => {
      expect(() => {
        check(doc, {
          name: 'Wrong',
        });
      }).toThrow();

      expect(() => {
        check(doc, {
          alias: 'Bob',
          height: 1.89,
        });
      }).toThrow();
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
    const arrayData = [
      {
        alias: 'Bob',
        name: 'Wrong',
        height: 1.89,
        avatar: {
          square: 'abc',
          circle: 'def',
          triangle: 'qwe',
        },
      },
      {
        alias: 'Tom',
        name: 'Right',
        height: 1.77,
        avatar: {
          square: 'jkl',
          circle: 'bnm',
          triangle: 'uio',
        },
      },
    ];
    const filteredArrayData = [
      {
        alias: 'Bob',
        height: 1.89,
        avatar: {
          square: 'abc',
          circle: 'def',
        },
      },
      {
        alias: 'Tom',
        height: 1.77,
        avatar: {
          square: 'jkl',
          circle: 'bnm',
        },
      },
    ];

    it('can filter data', () => {
      expect(filter(doc, data)).toEqual(filteredData);
    });

    it('can filter an array of data', () => {
      expect(filter(doc, arrayData)).toEqual(filteredArrayData);
    });

    it('can check matching data', () => {
      check(doc, filteredData);
    });

    // This doesn't throw but potentially it should?
    it('can check overspecified data', () => {
      check(doc, data);
    });

    it('throws when checking underspecified data', () => {
      expect(() => {
        check(doc, {
          name: 'Wrong',
        });
      }).toThrow();

      expect(() => {
        check(doc, [
          {
            name: 'Wrong',
          },
        ]);
      }).toThrow();

      expect(() => {
        check(doc, {
          alias: 'Bob',
          height: 1.89,
        });
      }).toThrow();

      expect(() => {
        check(doc, {
          alias: 'Bob',
          height: 1.89,
          avatar: {
            // missing the correct field
            triangle: 'qwe',
          },
        });
      }).toThrow();
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

        expect(filtered).toEqual({
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
