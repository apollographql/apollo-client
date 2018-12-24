test_and_lint_command="./scripts/test_and_lint.sh "
test_and_lint_command+="$@"

echo $test_and_lint_command

$(npm bin)/concurrently -r -k "yarn watch:test" "$test_and_lint_command"
