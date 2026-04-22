FROM node:18-alpine
RUN apk add --no-cache python3 make g++ 
WORKDIR /app  
COPY package*.json ./  
RUN npm install --omit=dev 
COPY . .  
EXPOSE 4000
ENV PORT=4000
CMD ["node", "server.js"]  
