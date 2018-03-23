set +e
npm run diff -- "$1" $CIRCLE_COMPARE_SCRIPT > /dev/null; rc=$?;
set -e

if [ ! ${rc} -eq 0 ]
then
  echo nothing changed that this command cares about;
else
  eval $2
fi;
