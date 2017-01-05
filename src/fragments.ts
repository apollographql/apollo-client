import {
  DocumentNode,
  FragmentDefinitionNode,
} from 'graphql';

import flatten = require('lodash/flatten');

import {
  getFragmentDefinitions,
} from './queries/getFromAST';

// A map going from the name of a fragment to that fragment's definition.
// The point is to keep track of fragments that exist and print a warning if we encounter two
// fragments that have the same name, i.e. the values *should* be of arrays of length 1.
// Note: this variable is exported solely for unit testing purposes. It should not be touched
// directly by application code.
export let fragmentDefinitionsMap: { [fragmentName: string]: FragmentDefinitionNode[] } = {};

// Specifies whether or not we should print warnings about conflicting fragment names.
let printFragmentWarnings = true;

// Takes a document, extracts the FragmentDefinitions from it and puts
// them in this.fragmentDefinitions. The second argument specifies the fragments
// that the fragment in the document depends on. The fragment definition array from the document
// is concatenated with the fragment definition array passed as the second argument and this
// concatenated array is returned.
let haveWarned = false;

export function createFragment(
  doc: DocumentNode,
  fragments: (FragmentDefinitionNode[] | FragmentDefinitionNode[][]) = [],
  internalUse = false,
): FragmentDefinitionNode[] {

  if (!internalUse) {
    if (! haveWarned) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
            '"createFragment" is deprecated and will be removed in version 0.6, ' +
            'please refer to the documentation for how to define fragments: ' +
            'http://dev.apollodata.com/react/fragments.html.',
        );
      }
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'test') {
        // When running tests, we want to print the warning every time
        haveWarned = true;
      }
    }
  }

  fragments = flatten(fragments) as FragmentDefinitionNode[];
  const fragmentDefinitions = getFragmentDefinitions(doc);
  fragmentDefinitions.forEach((fragmentDefinition: FragmentDefinitionNode) => {
    const fragmentName = fragmentDefinition.name.value;
    if (fragmentDefinitionsMap.hasOwnProperty(fragmentName) &&
        fragmentDefinitionsMap[fragmentName].indexOf(fragmentDefinition) === -1) {
      // this is a problem because the app developer is trying to register another fragment with
      // the same name as one previously registered. So, we tell them about it.
      if (printFragmentWarnings) {
        console.warn(`Warning: fragment with name ${fragmentDefinition.name.value} already exists.
Apollo Client enforces all fragment names across your application to be unique; read more about
this in the docs: http://docs.apollostack.com/`);
      }

      fragmentDefinitionsMap[fragmentName].push(fragmentDefinition);
    } else if (!fragmentDefinitionsMap.hasOwnProperty(fragmentName)) {
      fragmentDefinitionsMap[fragmentName] = [fragmentDefinition];
    }
  });

  return fragments.concat(fragmentDefinitions);
}

// This function disables the warnings printed about fragment names. One place where this chould be
// called is within writing unit tests that depend on Apollo Client and use named fragments that may
// have the same name across different unit tests.
export function disableFragmentWarnings() {
  printFragmentWarnings = false;
}

export function enableFragmentWarnings() {
  printFragmentWarnings = true;
}

// This function is used to be empty the namespace of fragment definitions. Used for unit tests.
export function clearFragmentDefinitions() {
  fragmentDefinitionsMap = {};
}
