import gql from 'graphql-tag';
import '@testing-library/jest-dom';
import { loadErrorMessageHandler } from '../../dev/loadErrorMessageHandler';
import '../../testing/matchers';

// Turn off warnings for repeated fragment names
gql.disableFragmentWarnings();

process.on('unhandledRejection', () => {});

loadErrorMessageHandler();
