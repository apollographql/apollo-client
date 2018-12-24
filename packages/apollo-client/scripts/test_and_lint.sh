sleep 5

run_command="yarn testonly"

if [[ $# -gt 0 ]]; then
    run_command+=' -- --grep "'
    run_command+=$@
    run_command+='"'
fi

lint_command="yarn lint"

command="$run_command"
command+=" && "
command+="$lint_command"

nodemon --watch lib --exec "$command" --delay 0.5
