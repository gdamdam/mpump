FROM node:20-slim
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY jam-relay.mjs .
EXPOSE 4444
CMD ["node", "jam-relay.mjs"]
