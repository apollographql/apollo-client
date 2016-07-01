test_and_lint_command="./scripts/test_and_lint.sh "
test_and_lint_command+="$@"

echo $test_and_lint_command

./node_modules/.bin/concurrently -r -k "npm run watch" "$test_and_lint_command"
