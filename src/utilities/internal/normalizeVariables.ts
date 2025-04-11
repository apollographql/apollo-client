/** Returns variables if there are 1 or more keys, otherwise returns undefined */
export function normalizeVariables<TVariables>(variables: TVariables) {
  if (variables && Object.keys(variables).length > 0) {
    return variables;
  }
}
