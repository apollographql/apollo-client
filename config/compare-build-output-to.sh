upstream=$1
comparison=/tmp/comparison_checkout
root=$(git rev-parse --show-toplevel)


patterndiff(){
  cd dist
  find -name "$1" -exec bash -c "echo {}; diff <(cat '$comparison/dist/'{} | tr \"'\" '\"') <(cat {} | tr \"'\" '\"' ) -w" \; > ../diff."$1".diff
  cd ..
}

[ -z "$upstream" ] && { echo "need upstream argument"; exit 1; }

git worktree add --force --detach --checkout "$comparison" "$upstream"

cd "$comparison"
yarn
yarn build
cd "$root"
yarn build

patterndiff "*.js"
patterndiff "*.cjs"
patterndiff "*.d.ts"

diff -r "$comparison/dist" "dist" -x "*.map" -x "*.native.*" -x "*.js" -x "*.cjs" -x "*.d.ts" -w > diff.rest.diff
