FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY bot.js .
CMD ["node", "bot.js"]
