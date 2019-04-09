import { disableFragmentWarnings } from 'graphql-tag';

// Turn off warnings for repeated fragment names
disableFragmentWarnings();

process.on('unhandledRejection', () => {});
