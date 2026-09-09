# Quadra UI - Dockerfile
# Build React + serve con Nginx

# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine as builder

WORKDIR /app

# Copia package files
COPY package*.json ./

# Installa dipendenze
RUN npm ci

# Copia sorgenti
COPY . .

# Build per produzione
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ============================================
# Stage 2: Serve con Nginx
# ============================================
FROM nginx:alpine as runtime

# Metadata
LABEL org.opencontainers.image.title="Quadra UI"
LABEL org.opencontainers.image.description="Frontend React per controllo contabile"

# Rimuovi config di default
RUN rm /etc/nginx/conf.d/default.conf

# Copia config Nginx personalizzata
COPY nginx.conf /etc/nginx/conf.d/

# Copia build da stage precedente
COPY --from=builder /app/dist /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Porta esposta
EXPOSE 80

# Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
