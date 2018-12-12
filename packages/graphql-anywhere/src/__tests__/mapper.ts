import graphql from '../';
import gql from 'graphql-tag';

import { cloneElement, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

describe('result mapper', () => {
  it('can deal with promises', () => {
    const resolver = (_, root) => {
      return new Promise(res => {
        setTimeout(() => {
          Promise.resolve(root).then(val => res(val + 'fake'));
        }, 10);
      });
    };

    function promiseForObject(object): Promise<{ [key: string]: any }> {
      const keys = Object.keys(object);
      const valuesAndPromises = keys.map(name => object[name]);

      return Promise.all(valuesAndPromises).then(values =>
        values.reduce((resolvedObject, value, i) => {
          resolvedObject[keys[i]] = value;
          return resolvedObject;
        }, Object.create(null)),
      );
    }

    const query = gql`
      {
        a {
          b
          c
        }
      }
    `;

    const result = graphql(resolver, query, '', null, null, {
      resultMapper: promiseForObject,
    });

    return result.then(value => {
      expect(value).toEqual({
        a: {
          b: 'fakefake',
          c: 'fakefake',
        },
      });
    });
  });

  it('can construct React elements', () => {
    const resolver = (fieldName, root, args) => {
      if (fieldName === 'text') {
        return args.value;
      }

      return createElement(fieldName, args);
    };

    const reactMapper = (childObj, root) => {
      const reactChildren = Object.keys(childObj).map(key => childObj[key]);

      if (root) {
        return cloneElement(root, root.props, ...reactChildren);
      }

      return reactChildren[0];
    };

    function gqlToReact(document): any {
      return graphql(resolver, document, '', null, null, {
        resultMapper: reactMapper,
      });
    }

    const query = gql`
      {
        div {
          s1: span(id: "my-id") {
            text(value: "This is text")
          }
          s2: span
        }
      }
    `;

    expect(renderToStaticMarkup(gqlToReact(query))).toBe(
      '<div><span id="my-id">This is text</span><span></span></div>',
    );
  });
});
