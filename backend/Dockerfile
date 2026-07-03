FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY backend/package*.json ./
RUN npm install --production

# Copy backend source
COPY backend/ ./

# Ensure public (frontend) exists. In CI we should copy built frontend into backend/public before building image.

ENV NODE_ENV=production

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
