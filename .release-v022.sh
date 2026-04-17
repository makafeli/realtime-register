#!/bin/bash
set -e
cd /Users/yasinboelhouwer/Agentskills/realtime-register
git add -A
git -c user.name="Yasin Boelhouwer" -c user.email="yasin@enginebit.com" \
  commit -F .commit-msg-v0.2.2.txt
rm .commit-msg-v0.2.2.txt
echo "---push---"
git push
