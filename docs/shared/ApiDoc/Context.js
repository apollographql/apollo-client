import PropTypes from 'prop-types';
import React, {createContext, useCallback, useContext, useMemo} from 'react';

const ApiDocContext = createContext();

export const Provider = ({value, children}) => {
  const allNodes = useMemo(() => {
    const allNodes = {};
    for (const node of value) {
      allNodes[node.canonicalReference] = node;
    }
    return allNodes;
  }, [value]);

  return (
    <ApiDocContext.Provider value={allNodes}>{children}</ApiDocContext.Provider>
  );
};

Provider.propTypes = {
  value: PropTypes.array.isRequired,
  children: PropTypes.node.isRequired
};

export function useApiDocContext() {
  const ctx = useContext(ApiDocContext);
  if (!ctx)
    throw new Error(
      '`useApiDocContext` can only be used wrapped in `ApiDocContext.Prodiver`!'
    );
  /**
   * @param {string | { canonicalReference: string }} canonicalReference
   * @param {boolean} throwIfNotFound
   */
  return useCallback(
    function getItem(canonicalReference, throwIfNotFound = true) {
      if (!canonicalReference) return null;
      if (typeof canonicalReference !== 'string') {
        // eslint-disable-next-line prefer-destructuring
        canonicalReference = canonicalReference.canonicalReference;
      }
      const value = ctx[canonicalReference];
      if (throwIfNotFound && !value)
        throw new Error(
          'No value found for canonicalReference: ' + canonicalReference
        );
      return value;
    },
    [ctx]
  );
}

self[Symbol.for('apollo-docs-useApiDocContext')] = useApiDocContext;
