FROM node:19

RUN mkdir /app
WORKDIR /app

COPY package.json .
ENV NODE_ENV=development
RUN npm install -g nodemon && npm install
COPY . .
CMD ["nodemon", "src/index.js"]
