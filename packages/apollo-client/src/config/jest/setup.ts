import process from 'process';
import { disableFragmentWarnings } from 'graphql-tag';

process.on('unhandledRejection', () => {});

// const { disableFragmentWarnings } = require('graphql-tag');

// Turn off warnings for repeated fragment names
disableFragmentWarnings();
