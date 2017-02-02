import { SelectionSetNode, FragmentDefinitionNode } from 'graphql';
import { isEqual } from '../util/isEqual';
import { GraphQLData, GraphQLObjectData, isObjectData } from '../graphql/data';
import { ID_KEY, GraphReference, getFieldKey } from './common';

/**
 * This is an internal interface that a user should *never* have access to. This
 * interface abstracts away how data is actually read and instead provides some
 * low level primitives for our higher level `readFromGraph` function.
 */
export interface GraphReadPrimitives {
  /**
   * Gets some more read primitives for a single node in the graph.
   */
  getNode (id: string): GraphNodeReadPrimitives | undefined;
}

/**
 * Read primitives on a graph node.
 */
export interface GraphNodeReadPrimitives {
  /**
   * Reads a scalar at a given key from the node.
   */
  getScalar (key: string): GraphQLData | undefined;

  /**
   * Reads a reference at a given key from the node.
   */
  getReference (key: string): GraphReference | undefined;
}

/**
 * Reads a tree of GraphQL data from a graph representation starting at the
 * provided `id`.
 *
 * If a `previousData` object is provided then referential equality will be
 * attempted to be preserved when reading from the graph if the objects turn out
 * to be equal.
 *
 * If a `previousData` object is provided then also stale data will tried to be
 * read when a partial read error is thrown. So instead of returning partial
 * data from the function we will look at the id of the previous data and try to
 * read from that id. In order to use this functionality make sure that the
 * `previousData` object was created by either `writeToGraph` or
 * `readFromGraph`.
 */
export function readFromGraph ({
  graph,
  id,
  selectionSet,
  fragments = {},
  variables = {},
  previousData,
  _currentData: data = createInitialData(id),
}: {
  graph: GraphReadPrimitives,
  id: string,
  selectionSet: SelectionSetNode,
  fragments?: { [fragmentName: string]: FragmentDefinitionNode },
  variables?: { [variableName: string]: GraphQLData },
  previousData?: GraphQLObjectData | null,

  // This is an object that is used as an implementation detail only! Because
  // identical GraphQL composite fields (arrays and objects) merge together, we
  // need to make sure we don’t replace these composite fields and instead merge
  // into the last composite field.
  //
  // This value represents the data object that should be merged into. This
  // object will be mutated and then returned. If all of the selection set
  // fields have equivalent values in the `previousData` option, then that will
  // be returned instead.
  //
  // Again, this is an implementation detail and should not be used by API
  // consumers!
  _currentData?: GraphQLObjectData,
}): {
  stale: boolean,
  data: GraphQLObjectData,
} {
  const node = graph.getNode(id);

  // If there is no node in the graph for this id then we need to throw a
  // partial read error.
  if (typeof node === 'undefined') {
    const error = new Error(`No store item for id '${id}'.`);
    (error as any)._partialRead = true;
    throw error;
  }

  // In this variable we will keep track of whether or not the data we read is
  // the same as the previous data. We start with `true` if `previousData`
  // exists.
  //
  // If the previous data has an `ID_KEY` we also check to make sure that it has
  // the same value as the id we are currently reading.
  let sameAsPrevious = !!previousData && (typeof previousData[ID_KEY] !== 'string' || previousData[ID_KEY] === id);

  // This will be set to true if there is at least one part of the tree we are
  // reading that is stale.
  let stale = false;

  selectionSet.selections.forEach(selection => {
    // For fields we need to read the field from the store and add it to our
    // data object.
    if (selection.kind === 'Field') {
      const field = selection;
      const fieldSelectionSet = field.selectionSet;
      const fieldName = field.alias ? field.alias.value : field.name.value;
      const fieldKey = getFieldKey(field, variables);

      // If there is no selection set, then this field is a scalar and we
      // should read from the node’s scalars.
      if (!fieldSelectionSet) {
        let fieldData = node.getScalar(fieldKey);
        const previousFieldData = isObjectData(previousData) ? previousData[fieldName] : undefined;

        // If there is no value in the node for this field then we need to
        // throw a partial read error.
        if (typeof fieldData === 'undefined') {
          const error = new Error(`No scalar value found for field '${fieldName}'.`);
          (error as any)._partialRead = true;
          throw error;
        }

        // If the field data and the previous field data are deeply equal then
        // use the previous field data to maintain referential equality.
        if (typeof previousFieldData !== 'undefined' && isEqual(fieldData, previousFieldData)) {
          fieldData = previousFieldData;
        }

        data[fieldName] = fieldData;

        // If so far we know that this is the same object, and we have some
        // previous data then compare this scalar with the previous scalar.
        if (sameAsPrevious && typeof previousFieldData !== 'undefined' && fieldData !== previousFieldData) {
          sameAsPrevious = false;
        }
      }
      // Otherwise this is a composite value and we should try reading it from
      // the store using a reference.
      else {
        const fieldReference = node.getReference(fieldKey);
        const previousFieldData = previousData && previousData[fieldName];

        // If no reference could be found for this field key then we need to
        // throw a partial read error.
        if (typeof fieldReference === 'undefined') {
          const error = new Error(`No graph reference found for field '${fieldName}'.`);
          (error as any)._partialRead = true;
          throw error;
        }

        try {
          const {
            stale: fieldStale,
            data: fieldData,
          } = readReferenceFromGraph({
            graph,
            reference: fieldReference,
            selectionSet: fieldSelectionSet,
            fragments,
            variables,
            previousData: previousFieldData,
            _currentData: data[fieldName],
          });

          // If the field and the previous field are not the same then the
          // object is not the same as the previous object.
          if (sameAsPrevious && fieldData !== previousFieldData) {
            sameAsPrevious = false;
          }

          // If this field is stale then make sure our stale flag is set to
          // true.
          if (fieldStale) {
            stale = true;
          }

          data[fieldName] = fieldData;
        } catch (error) {
          // If this error was not a partial read or we have no previous data
          // for this field then throw the error anyway.
          if (!error._partialRead || typeof previousFieldData === 'undefined') {
            throw error;
          }
          const previousFieldReference = getReferenceFromData(previousFieldData);
          const { data: fieldData } = readReferenceFromGraph({
            graph,
            reference: previousFieldReference,
            selectionSet: fieldSelectionSet,
            fragments,
            variables,
            previousData: previousFieldData,
            _currentData: data[fieldName],
          });

          // If the field and the previous field are not the same then the
          // object is not the same as the previous object.
          if (sameAsPrevious && fieldData !== previousFieldData) {
            sameAsPrevious = false;
          }

          // If we are reading using a previous field reference then we know
          // this is stale, so set our flag!
          stale = true;

          data[fieldName] = fieldData;
        }
      }
    }
    // For fragments we want to try reading an entire fragment from the store.
    // If it fails with a partial read error then we can silently discard the
    // fragment.
    else if (selection.kind === 'FragmentSpread' || selection.kind === 'InlineFragment') {
      let fragmentSelectionSet: SelectionSetNode;

      // Get the fragment from our fragment map if this is a fragment spread.
      // Otherwise use the selection set in the selection itself.
      if (selection.kind === 'FragmentSpread') {
        const fragmentName = selection.name.value;
        const fragment = fragments[fragmentName];
        if (typeof fragment === 'undefined') {
          throw new Error(`Could not find fragment named '${fragmentName}'.`);
        }
        fragmentSelectionSet = fragment.selectionSet;
      }
      else {
        fragmentSelectionSet = selection.selectionSet;
      }

      try {
        const {
          stale: fragmentStale,
          data: fragmentData,
        } = readFromGraph({
          graph,
          id,
          selectionSet: fragmentSelectionSet,
          fragments,
          variables,
          previousData,
          _currentData: data,
        });

        // If the previous data and the fragment data are not referentially
        // equal then we know that the object we are building is not the same
        // as the previous object.
        if (sameAsPrevious && fragmentData !== previousData) {
          sameAsPrevious = false;
        }

        // If there is stale data in the fragment make sure to set our stale
        // flag to true.
        if (fragmentStale) {
          stale = true;
        }
      } catch (error) {
        // Re-throw an errors that are not partial read errors. We can safely
        // ignore partial read errors.
        if (!error._partialRead) {
          throw error;
        }
      }
    }
    else {
      throw new Error(`Unrecognized selection '${(selection as any).kind}'`);
    }
  });

  return {
    stale,
    data: previousData && sameAsPrevious ? previousData : data,
  };
}

/**
 * Reads a reference from the Graph. A reference can be null, a string, or an
 * arbitrarily nested array of strings and nulls. If the reference is an array
 * this function will return an array in the same shape.
 *
 * @private
 */
function readReferenceFromGraph ({
  graph,
  reference,
  selectionSet,
  fragments,
  variables,
  previousData,
  _currentData,
}: {
  graph: GraphReadPrimitives,
  reference: GraphReference,
  selectionSet: SelectionSetNode,
  fragments: { [fragmentName: string]: FragmentDefinitionNode },
  variables: { [variableName: string]: GraphQLData },
  previousData: GraphQLData | undefined,
  _currentData: GraphQLData | undefined,
}): {
  stale: boolean,
  data: GraphQLData,
} {
  // If the reference is simply null then we may simply return null.
  if (reference === null) {
    return {
      stale: false,
      data: null,
    };
  }
  // For an array reference we should read each sub reference seperately.
  //
  // NOTE: We currently build a map of ids to previous data items by iterating
  // through all of the previous data items. This could be more efficient.
  else if (Array.isArray(reference)) {
    const idToPreviousItemData: { [id: string]: GraphQLObjectData } = {};

    // Build a map out of the previous data array of ids to the previous data
    // value. We will use this in iteration later on.
    //
    // We need this map in case the array gets out of order, but data stays the
    // same. In that case we still want to return referentially equal items, so
    // we build this map to track which ids match related items.
    if (Array.isArray(previousData)) {
      previousData.forEach(item => {
        if (isObjectData(item) && typeof item[ID_KEY] === 'string') {
          idToPreviousItemData[item[ID_KEY] as string] = item;
        }
      });
    }

    // These two values mean the same thing as they do in the implementation of
    // `readFromGraph`.
    let sameAsPrevious = Array.isArray(previousData) && previousData.length === reference.length;
    let stale = false;

    const data = reference.map((referenceItem, i) => {
      let previousItemData: GraphQLData | undefined;

      // Try to get the previous data item from the map we built if we have an
      // actual string id.
      if (typeof referenceItem === 'string') {
        previousItemData = idToPreviousItemData[referenceItem];
      }

      // If the previous data is an array then simply try to get the item at the
      // current index.
      if (typeof previousItemData === 'undefined' && Array.isArray(previousData)) {
        previousItemData = previousData[i];
      }

      const {
        stale: itemStale,
        data: itemData,
      } = readReferenceFromGraph({
        graph,
        reference: referenceItem,
        selectionSet,
        fragments,
        variables,
        previousData: previousItemData,
        _currentData: Array.isArray(_currentData) ? _currentData[i] : undefined,
      });

      // If the item and the previous item in the same position are not the same
      // then these arrays are not the same.
      if (sameAsPrevious && Array.isArray(previousData) && itemData !== previousData[i]) {
        sameAsPrevious = false;
      }

      // If this is item is stale then make sure our stale flag is set to true.
      if (itemStale) {
        stale = true;
      }

      return itemData;
    });

    return {
      stale,
      data: previousData && sameAsPrevious ? previousData : data,
    };
  }
  // If the reference is not null or an array then it is a string and we should
  // read directly from the graph.
  else {
    // Type-guard for non-object data.
    if (typeof previousData !== 'undefined' && previousData !== null && !isObjectData(previousData)) {
      throw new Error(`The previous data for this reference must be an object. Not '${typeof previousData}'.`);
    }
    return readFromGraph({
      graph,
      id: reference,
      selectionSet,
      fragments,
      variables,
      previousData,
      _currentData: isObjectData(_currentData) ? _currentData : undefined,
    });
  }
}

/**
 * Creates the initial data object that will be read into. This object is
 * created with a store id so that the store id may be set as the `ID_KEY` on
 * the object.
 *
 * @private
 */
function createInitialData (id: string): GraphQLObjectData {
  return Object.create(Object.prototype, {
    [ID_KEY]: {
      configurable: false,
      enumerable: false,
      writable: false,
      value: id,
    },
  });
}

/**
 * Gets a reference to some ids in the store from a data object created by
 * `readFromStore`. May return an arbitrarily nested array of ids instead of
 * just one.
 *
 * @private
 */
function getReferenceFromData (data: GraphQLData): GraphReference {
  // If the data is exacly null then the reference is null as well.
  if (data === null) {
    return null;
  }
  // If the data provided is an array then try to get the store reference for
  // each item individually.
  else if (Array.isArray(data)) {
    return data.map(item => getReferenceFromData(item));
  }
  // If the data has a store id then return that store id.
  else if (typeof data === 'object' && typeof data[ID_KEY] === 'string') {
    return data[ID_KEY] as string;
  }
  // Otherwise we can’t get the reference so we should just throw an error!
  else {
    throw new Error('Could not get a reference from data.');
  }
}
