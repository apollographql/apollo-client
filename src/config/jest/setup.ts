import gql from 'graphql-tag';
import '@testing-library/jest-dom';
import {loadErrorMessages} from '../../utilities/errors';
// Turn off warnings for repeated fragment names
gql.disableFragmentWarnings();

process.on('unhandledRejection', () => {});

loadErrorMessages();