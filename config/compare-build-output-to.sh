#!/usr/bin/env bash
set -euo pipefail
upstream=$1
comparison="${RUNNER_TEMP:-/tmp}/comparison_checkout"
root=$(git rev-parse --show-toplevel)

temp=$(mktemp --tmpdir="${RUNNER_TEMP:-/tmp}")
trap 'rm -f "$temp"' EXIT

patterndiff(){
  cd dist || { echo "dist folder not found"; exit 1; }
  count=0
  while IFS= read -r -d '' file
  do
    if ! filediff="$(diff <(tr "'" '"' < "$comparison/dist/$file") <(tr "'" '"' < "$root/dist/$file") -w)"; then
      (( count++ ))
      echo "$file"
      if [[ "$file" == *.min.* ]]; then
        echo "> Minified file differs."
      else
        echo "$filediff"
      fi
    fi
  done >"$temp" < <(find . -name "$1" -print0)

  output="$(cat <"$temp")"

  cat <<EOF

## differences in $1 files

<details>
  <summary>

### $count files with differences

  </summary>

\`\`\`diff

$output

\`\`\`

</details>
EOF

  cd ..
}

[ -z "$upstream" ] && { echo "need upstream argument"; exit 1; }

git worktree add --force --detach --checkout "$comparison" "$upstream" || { cd "$comparison" && git checkout "$upstream"; } || exit 1

cd "$comparison" || { echo "checkout failed"; exit 1; }
cp -r "$root/node_modules" .
npm i >&2
git status >&2
npm run build >&2
cd "$root" || exit 1
git status >&2
npm run build >&2

set +e

patterndiff "*.js"
patterndiff "*.cjs"
patterndiff "*.d.ts"

cat <<EOF


## differences in other files

<details>
  <summary>

### $(diff -qr "$comparison/dist" "dist" -x "*.map" -x "*.native.*" -x "*.js" -x "*.cjs" -x "*.d.ts" -w | wc -l) files with differences

  </summary>

\`\`\`diff

$(diff -r "$comparison/dist" "dist" -x "*.map" -x "*.native.*" -x "*.js" -x "*.cjs" -x "*.d.ts" -w)

\`\`\`

</details>
EOF
