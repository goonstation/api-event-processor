FROM node:19

RUN mkdir /app
WORKDIR /app

RUN apt-get update && \
    apt-get install -y nano git

COPY package.json .
RUN npm install -g pm2 && npm install
