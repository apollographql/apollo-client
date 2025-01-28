// @ts-check
/** @param {import('@actions/github-script').AsyncFunctionArguments} AsyncFunctionArguments */
export function setup({ context, github }) {
  console.log(arguments);
  return {
    async add_cleanup_label() {
      await github.rest.issues.addLabels({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        labels: ["auto-cleanup"],
      });
    },
  };
}
