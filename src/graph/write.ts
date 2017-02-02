import { SelectionSetNode, FragmentDefinitionNode } from 'graphql';
import { GraphQLData, GraphQLObjectData, GraphQLArrayData, isObjectData } from '../graphql/data';
import { ID_KEY, GraphReference, getFieldKey } from './common';

/**
 * The type for the `dataIdFromObject` function.
 */
export interface GetDataIDFn {
  (data: GraphQLObjectData): string | null | undefined;
}

/**
 * This is an internal interface that a user should *never* have access to. This
 * interface abstracts away how data is actually written and instead provides
 * some low level primitives for our higher level `writeToGraph` function.
 */
export interface GraphWritePrimitives {
  /**
   * Gets a node or creates a new one.
   */
  getOrCreateNode (id: string): GraphNodeWritePrimitives;
}

/**
 * Write primitives on a graph node.
 */
export interface GraphNodeWritePrimitives {
  /**
   * Sets a scalar value for a given key on this node.
   */
  setScalar (key: string, data: GraphQLData): void;

  /**
   * Sets the reference for a given key on this node.
   */
  setReference (key: string, reference: GraphReference): void;
}

/**
 * Writes GraphQL tree data to a true graph format. Returns a new data object
 * which represents what was written to the store.
 *
 * Starts writing the tree to the provided id. If no id was provided then no
 * data will be written until we can find an id using `getDataID`.
 *
 * Nodes in the data graph cannot be correctly identified without a `getDataID`
 * function. By default a new node will be created for every object, but the id
 * will be the path to that data in the tree. `getDataID` should properly
 * identify nodes wherever they are in the tree.
 *
 * When a node is found using `getDataID` the value returned by `getDataID` will
 * be wrapped in parentheses (`(` and `)`) as to avoid conflicts with other root
 * keys. It also prevents accidently reading data from a private id.
 */
export function writeToGraph ({
  graph,
  id,
  data,
  selectionSet,
  fragments = {},
  variables = {},
  getDataID = () => null,
  _currentData: nextData = createInitialData(id),
}: {
  graph: GraphWritePrimitives,
  id: string | null,
  data: GraphQLObjectData,
  selectionSet: SelectionSetNode,
  fragments?: { [fragmentName: string]: FragmentDefinitionNode },
  variables?: { [variableName: string]: GraphQLData },
  getDataID?: GetDataIDFn,

  // A private implementation detail similar to the `_currentData` option in
  // `readFromGraph`. To understand better what this option is for then read the
  // documentation there.
  _currentData?: GraphQLObjectData,
}): {
  data: GraphQLObjectData,
} {
  const node = id !== null ? graph.getOrCreateNode(id) : null;

  selectionSet.selections.forEach(selection => {
    // For fields we want to directly write the data into our store.
    if (selection.kind === 'Field') {
      const field = selection;
      const fieldSelectionSet = field.selectionSet;
      const fieldName = field.alias ? field.alias.value : field.name.value;
      const fieldKey = getFieldKey(field, variables);
      const fieldData = data[fieldName];

      // If we have no data for this field then throw an error. This error
      // may be caught if we are currently writing data for a fragment.
      if (typeof fieldData === 'undefined') {
        const error = new Error(`No data found for field '${fieldName}'.`);
        (error as any)._partialWrite = true;
        throw error;
      }
      // If there is no selection set for this field then it is a scalar!
      else if (!fieldSelectionSet) {
        nextData[fieldName] = fieldData;
        if (node !== null) {
          node.setScalar(fieldKey, fieldData);
        }
      }
      // If the data is null and this is not a scalar then we need to set our
      // reference to null.
      else if (fieldData === null) {
        nextData[fieldName] = null;
        if (node !== null) {
          node.setReference(fieldKey, null);
        }
      }
      // If by this point the field data is not an object (like we expect)
      // then throw an error.
      else if (typeof fieldData !== 'object') {
        throw new Error(`Expected composite data for field '${fieldName}' to be null or an object. Not '${typeof fieldData}'`);
      }
      // If the field data is an array then we need to defer to our
      // `writeArrayToStore` function.
      else if (Array.isArray(fieldData)) {
        const currentFieldData = nextData[fieldName];
        const {
          reference: fieldReference,
          data: nextFieldData,
        } = writeArrayToGraph({
          graph,
          id: id && `${id}.${fieldKey}`,
          data: fieldData,
          selectionSet: fieldSelectionSet,
          fragments,
          variables,
          getDataID,
          _currentData: Array.isArray(currentFieldData) ? currentFieldData : undefined,
        });
        nextData[fieldName] = nextFieldData;
        if (node !== null) {
          node.setReference(fieldKey, fieldReference);
        }
      }
      // Otherwise do the write thing.
      else {
        const fieldDataID = getDataID(fieldData);
        const fieldID = typeof fieldDataID === 'string' ? `(${fieldDataID})` : id && maybeAddTypeName(`${id}.${fieldKey}`, fieldData);

        // Add the field id to our store item’s references.
        if (node !== null) {
          node.setReference(fieldKey, fieldID);
        }

        // Write the data in this field to the store.
        const currentFieldData = nextData[fieldName];
        const { data: nextFieldData } = writeToGraph({
          graph,
          id: fieldID,
          data: fieldData,
          selectionSet: fieldSelectionSet,
          fragments,
          variables,
          getDataID,
          _currentData: isObjectData(currentFieldData) ? currentFieldData : undefined,
        });

        nextData[fieldName] = nextFieldData;
      }
    }
    // For fragments we want to try writing the fragment, and if a partial write
    // is thrown then we want to silently discard the fragment.
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
        const { data: fragmentData } = writeToGraph({
          graph,
          id,
          data,
          selectionSet: fragmentSelectionSet,
          fragments,
          variables,
          getDataID,
          _currentData: nextData,
        });
      } catch (error) {
        // If the error is not a partial write error then make sure it is
        // correctly propogated. Otherwise we can ignore the error and this
        // fragment data will not be written to the store.
        if (!error._partialWrite) {
          throw error;
        }
      }
    }
    else {
      throw new Error(`Unrecognized selection '${(selection as any).kind}'`);
    }
  });

  return { data: nextData };
}

/**
 * Private function used in the implementation of `writeToStore`. This function
 * returns a potentially nested array of store ids and as a side effect writes
 * items to the store parameter.
 *
 * @private
 */
function writeArrayToGraph ({
  graph,
  id,
  data,
  selectionSet,
  fragments,
  variables,
  getDataID,
  _currentData,
}: {
  graph: GraphWritePrimitives,
  id: string | null,
  data: GraphQLArrayData,
  selectionSet: SelectionSetNode,
  fragments: { [fragmentName: string]: FragmentDefinitionNode },
  variables: { [variableName: string]: GraphQLData },
  getDataID: GetDataIDFn,
  _currentData: GraphQLArrayData | undefined,
}): {
  reference: GraphReference,
  data: GraphQLArrayData,
} {
  const reference: GraphReference = [];
  const nextData: GraphQLArrayData = [];

  data.forEach((itemData, i) => {
    const currentItemData = Array.isArray(_currentData) && _currentData[i];
    // If the item data is an array then we want to recurse.
    if (Array.isArray(itemData)) {
      const {
        reference: itemReference,
        data: nextItemData,
      } = writeArrayToGraph({
        graph,
        id: id && `${id}[${i}]`,
        data: itemData,
        selectionSet,
        fragments,
        variables,
        getDataID,
        _currentData: Array.isArray(currentItemData) ? currentItemData : undefined,
      });
      reference.push(itemReference);
      nextData.push(nextItemData);
    }
    // If the item data is null then we want to add null as a reference and as
    // the next item data.
    else if (itemData === null) {
      reference.push(null);
      nextData.push(null);
    }
    // If the item data is not an object then we should throw an error because
    // we expected an object.
    else if (typeof itemData !== 'object') {
      throw new Error(`Expected composite data in array to be null or an object. Not '${typeof itemData}'`);
    }
    // Otherwise do the write thing.
    else {
      const itemDataID = getDataID(itemData);
      const itemID = typeof itemDataID === 'string' ? `(${itemDataID})` : id && maybeAddTypeName(`${id}[${i}]`, itemData);

      reference.push(itemID);
      const { data: nextItemData } = writeToGraph({
        graph,
        id: itemID,
        data: itemData,
        selectionSet,
        fragments,
        variables,
        getDataID,
        _currentData: isObjectData(currentItemData) ? currentItemData : undefined,
      });
      nextData.push(nextItemData);
    }
  });

  return { reference, data: nextData };
}

/**
 * Creates the initial data object that will be read into after writing. This
 * object is created with a store id so that the store id may be set as the
 * `ID_KEY` on the object.
 *
 * @private
 */
function createInitialData (id: string | null): GraphQLObjectData {
  return id === null ? {} : Object.create(Object.prototype, {
    [ID_KEY]: {
      configurable: false,
      enumerable: false,
      writable: false,
      value: id,
    },
  });
}

/**
 * Adds a type name to the `id` if the `data` object has a `__typename`
 * property.
 */
function maybeAddTypeName (id: string, data: GraphQLObjectData): string {
  return typeof data['__typename'] === 'string' ? `${id}:${data['__typename']}` : id;
}
