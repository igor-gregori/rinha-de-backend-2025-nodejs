#!/bin/bash

set -e

echo "🚀 Iniciando deploy da Rinha de Backend 2025..."

# Criar redes se não existirem
echo "🔧 Criando redes Docker..."
docker network create backend 2>/dev/null || echo "Rede 'backend' já existe"

# Parar e remover containers existentes
echo "🛑 Parando containers existentes..."
docker compose down --remove-orphans 2>/dev/null || true

# Limpar volumes se solicitado
if [[ "$1" == "--clean" ]]; then
    echo "🧹 Limpando volumes..."
    docker volume prune -f
fi

# Build e start dos serviços
echo "🔨 Building imagens..."
docker compose build --parallel

echo "🚀 Iniciando serviços..."
docker compose up -d

# Aguardar serviços ficarem prontos
echo "⏳ Aguardando serviços ficarem prontos..."
sleep 5

# Verificar status dos serviços
echo "📊 Status dos serviços:"
docker compose ps

# Teste básico de conectividade
echo "🔍 Testando conectividade..."
curl -f http://localhost:9999/healthcheck && echo "✅ API está respondendo" || echo "❌ API não está respondendo"

echo "✅ Deploy concluído!"
echo "💡 API disponível em: http://localhost:9999"
echo "💡 Para visualizar logs: docker compose logs -f"
echo "💡 Para parar: docker compose down"
