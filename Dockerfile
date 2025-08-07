FROM node:20-bookworm

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-scripts

COPY tsconfig.json .
COPY src/ src

# build the code
RUN yarn build

ENTRYPOINT [ "yarn", "start" ]