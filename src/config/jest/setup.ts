import gql from 'graphql-tag';
import '@testing-library/jest-dom';
import '../../testing/matchers';

// Turn off warnings for repeated fragment names
gql.disableFragmentWarnings();

process.on('unhandledRejection', () => {});
