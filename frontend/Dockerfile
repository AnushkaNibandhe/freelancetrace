FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Assuming Vite build
RUN npm run build
# Serve the build output using a simple server
RUN npm install -g serve

EXPOSE 8080
CMD ["serve", "-s", "dist", "-l", "8080"]
