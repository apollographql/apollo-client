const { includes } = require('lodash');
const fs = require('fs');

// Setup
const github = danger.github;
const pr = github.pr;
const commits = github.commits;
const modified = danger.git.modified_files;
const bodyAndTitle = (pr.body + pr.title).toLowerCase();
console.log(commits.map(({ sha }) => sha));

// Custom modifiers for people submitting PRs to be able to say "skip this"
const trivialPR = bodyAndTitle.includes('trivial');
const acceptedNoTests = bodyAndTitle.includes('skip new tests');

const typescriptOnly = (file: string) => includes(file, '.ts');
const filesOnly = (file: string) =>
  fs.existsSync(file) && fs.lstatSync(file).isFile();

// Custom subsets of known files
const modifiedAppFiles = modified
  .filter(p => includes(p, 'src/') || includes(p, 'test/'))
  .filter(p => filesOnly(p) && typescriptOnly(p));

// Takes a list of file paths, and converts it into clickable links
const linkableFiles = paths => {
  const repoURL = pr.head.repo.html_url;
  const ref = pr.head.ref;
  const links = paths.map(path => {
    return createLink(`${repoURL}/blob/${ref}/${path}`, path);
  });
  return toSentence(links);
};

// ["1", "2", "3"] to "1, 2 and 3"
const toSentence = (array: Array<string>): string => {
  if (array.length === 1) {
    return array[0];
  }
  return array.slice(0, array.length - 1).join(', ') + ' and ' + array.pop();
};

// ("/href/thing", "name") to "<a href="/href/thing">name</a>"
const createLink = (href: string, text: string): string =>
  `<a href='${href}'>${text}</a>`;

// Raise about missing code inside files
const raiseIssueAboutPaths = (
  type: Function,
  paths: string[],
  codeToInclude: string,
) => {
  if (paths.length > 0) {
    const files = linkableFiles(paths);
    const strict = '<code>' + codeToInclude + '</code>';
    type(`Please ensure that ${strict} is enabled on: ${files}`);
  }
};

console.log('GitHub PR Username:', pr && pr.user && pr.user.login);

const githubBotUsernames = ['greenkeeper', 'renovate[bot]'];

const isBot =
  pr && pr.user && pr.user.login && githubBotUsernames.includes(pr.user.login);

// Rules
if (!isBot) {
  // make sure someone else reviews these changes
  // const someoneAssigned = danger.github.pr.assignee;
  // if (someoneAssigned === null) {
  //   warn(
  //     'Please assign someone to merge this PR, and optionally include people who should review.'
  //   );
  // }

  // When there are app-changes and it's not a PR marked as trivial, expect
  // there to be CHANGELOG changes.
  const changelogChanges = modified.some(x => x.indexOf('CHANGELOG') > -1);
  if (modifiedAppFiles.length > 0 && !trivialPR && !changelogChanges) {
    fail('No CHANGELOG added.');
  }

  // No PR is too small to warrant a paragraph or two of summary
  if (pr.body.length === 0) {
    fail('Please add a description to your PR.');
  }

  const hasAppChanges = modifiedAppFiles.length > 0;

  const testChanges = modifiedAppFiles.filter(filepath =>
    filepath.includes('test'),
  );
  const hasTestChanges = testChanges.length > 0;

  // Warn when there is a big PR
  const bigPRThreshold = 500;
  if (github.pr.additions + github.pr.deletions > bigPRThreshold) {
    warn(':exclamation: Big PR');
  }

  // Warn if there are library changes, but not tests
  if (hasAppChanges && !hasTestChanges) {
    warn(
      "There are library changes, but not tests. That's OK as long as you're refactoring existing code",
    );
  }

  // Be careful of leaving testing shortcuts in the codebase
  const onlyTestFiles = testChanges.filter(x => {
    const content = fs.readFileSync(x).toString();
    return (
      content.includes('it.only') ||
      content.includes('describe.only') ||
      content.includes('fdescribe') ||
      content.includes('fit(')
    );
  });
  raiseIssueAboutPaths(fail, onlyTestFiles, 'an `only` was left in the test');
}
