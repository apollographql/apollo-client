import gql from 'graphql-tag';
import '@testing-library/jest-dom';

// Turn off warnings for repeated fragment names
gql.disableFragmentWarnings();

process.on('unhandledRejection', () => {});

// @ts-ignore
globalThis[Symbol.for('ApolloErrorMessageHandler')] = (message: string|number, getArgsLazy?: () => unknown[]) => {
  const args = getArgsLazy ? getArgsLazy() : [];
  return args.reduce<string>((msg, arg) => msg.replace("%s", String(arg)), String(message));
}
