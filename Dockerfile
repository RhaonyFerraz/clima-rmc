# Imagem oficial e leve do Node.js
FROM node:22-alpine

# Define diretório de trabalho dentro do container
WORKDIR /app

# Instala dependências de build necessárias para compilar pacotes nativos (se houver)
RUN apk add --no-cache python3 make g++

# Copia arquivos de definição de pacotes
COPY package*.json ./

# Instala dependências de produção
RUN npm install --omit=dev

# Copia todo o código-fonte
COPY . .

# Garante a existência do diretório de dados persistentes do SQLite
RUN mkdir -p /app/data

# Define variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/clima_rmc.db

# Expõe a porta do servidor
EXPOSE 3000

# Healthcheck para provedores de nuvem (AWS ECS, Google Cloud Run, Render, Railway)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Comando de inicialização
CMD ["node", "src/server.js"]
