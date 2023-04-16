#!/bin/bash
#

url=$(git config --get remote.origin.url)

re="^(https|git)(:\/\/|@)([^\/:]+)[\/:]([^\/:]+)\/(.+)(\.git)?$"

if [[ $url =~ $re ]]; then
    protocol=${BASH_REMATCH[1]}
    separator=${BASH_REMATCH[2]}
    hostname=${BASH_REMATCH[3]}
    user=${BASH_REMATCH[4]}
    repo=$(basename ${BASH_REMATCH[5]} .git)
fi

REPO=$user/$repo

LAST=$(curl -s -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/${REPO}/releases | jq -r .[0].tag_name)

LATEST=$1

echo **Full Changelog**: https://github.com/${REPO}/compare/${LAST}...${LATEST}

git log --pretty="- %s" ${LAST}..${LATEST}
