#echo "Yeah baby"
git submodule init --recursive
USE_CONSTRAINT_FILE=false make mountable
cd packages/mountable
yarn start