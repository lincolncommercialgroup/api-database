FROM node:14

WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies, including devDependencies
RUN npm install

# Copy app source
COPY . .

EXPOSE 3000

# Use nodemon for development
CMD ["npm", "run", "dev"]