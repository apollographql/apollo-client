sleep 5

run_command="npm run testonly"

if [[ $# -gt 0 ]]; then
    run_command+=' -- --grep "'
    run_command+=$@
    run_command+='"'
fi

lint_command="npm run lint"

command="$run_command"
command+=" && "
command+="$lint_command"

nodemon --watch lib --exec "$command" --delay 0.5
