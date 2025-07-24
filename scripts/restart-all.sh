#!/bin/bash

set -e

echo "🔄 Reiniciando serviços da Rinha de Backend 2025..."

# Parar serviços
echo "🛑 Parando serviços..."
docker-compose down

# Aguardar cleanup
sleep 2

# Reiniciar serviços
echo "🚀 Reiniciando serviços..."
docker-compose up -d

# Aguardar serviços ficarem prontos
echo "⏳ Aguardando serviços ficarem prontos..."
sleep 15

# Verificar status
echo "📊 Status dos serviços:"
docker-compose ps

# Teste básico
echo "🔍 Testando conectividade..."
if curl -sf http://localhost:9999/healthcheck > /dev/null; then
    echo "✅ API está respondendo"
else
    echo "❌ API não está respondendo"
    echo "🔍 Verificando logs dos últimos 30 segundos..."
    docker-compose logs --since 30s
    exit 1
fi

echo "✅ Restart concluído!"
echo "💡 Para teste de carga: ./stress-test.sh [usuarios] [requests_por_usuario]"