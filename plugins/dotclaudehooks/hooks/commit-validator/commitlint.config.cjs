// Commitlint configuration aligned with git.md rules:
// - Single line only (no body, no footer)
// - Max 96 characters
// - Allowed types: feat, fix, docs, style, refactor, test, chore, wip
// - type: is required, subject is required

module.exports = {
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'wip'],
    ],
    'type-empty': [2, 'never'],
    'type-case': [2, 'always', 'lower-case'],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 96],
    'body-empty': [2, 'always'],
    'footer-empty': [2, 'always'],
  },
};
