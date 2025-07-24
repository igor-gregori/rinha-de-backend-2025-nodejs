#!/bin/bash

set -e

echo "🧹 Iniciando reset das bases de dados da Rinha de Backend 2025..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para exibir status
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar se os serviços estão rodando
print_status "Verificando status dos serviços..."
if ! docker compose ps | grep -q "Up"; then
    print_warning "Serviços não estão rodando. Iniciando serviços primeiro..."
    docker compose up -d
    sleep 10
fi

# 1. Limpar Redis (cache)
print_status "Limpando cache Redis..."
if docker compose exec -T redis redis-cli FLUSHALL > /dev/null 2>&1; then
    print_success "Cache Redis limpo"
else
    print_error "Falha ao limpar Redis"
fi

# 2. Limpar base principal via endpoint DELETE
print_status "Limpando base principal via endpoint DELETE..."
if curl -sf -X DELETE http://localhost:9999/payments > /dev/null 2>&1; then
    print_success "Base principal limpa via DELETE /payments"
else
    print_error "Falha ao limpar base principal via DELETE /payments"
fi

# 3. Limpar base do payment processor default
print_status "Limpando base do payment processor default..."
if curl -sf -X POST -H "X-Rinha-Token: 123" http://localhost:8001/admin/purge-payments > /dev/null 2>&1; then
    print_success "Base do payment processor default limpa"
else
    print_error "Falha ao limpar base do payment processor default"
fi

# 4. Limpar base do payment processor fallback
print_status "Limpando base do payment processor fallback..."
if curl -sf -X POST -H "X-Rinha-Token: 123" http://localhost:8002/admin/purge-payments > /dev/null 2>&1; then
    print_success "Base do payment processor fallback limpa"
else
    print_error "Falha ao limpar base do payment processor fallback"
fi

# 5. Reiniciar workers para limpar estado em memória
print_status "Reiniciando workers para limpar estado em memória..."
docker compose restart payment-worker-one payment-worker-two payment-life-checker > /dev/null 2>&1
print_success "Workers reiniciados"

# 6. Verificação final
print_status "Executando verificação final..."
sleep 5

# Testar conectividade
if curl -sf http://localhost:9999/healthcheck > /dev/null 2>&1; then
    print_success "API principal está respondendo"
else
    print_error "API principal não está respondendo"
fi

# Verificar se Redis está limpo
REDIS_KEYS=$(docker compose exec -T redis redis-cli DBSIZE | tr -d '\r\n')
if [ "$REDIS_KEYS" = "0" ]; then
    print_success "Redis confirmado como limpo (0 chaves)"
else
    print_warning "Redis ainda tem $REDIS_KEYS chaves"
fi

# Verificar endpoints dos processors
print_status "Verificando conectividade dos payment processors..."
if curl -sf http://localhost:8001/payments/service-health > /dev/null 2>&1; then
    print_success "Payment processor default está respondendo"
else
    print_warning "Payment processor default não está respondendo"
fi

if curl -sf http://localhost:8002/payments/service-health > /dev/null 2>&1; then
    print_success "Payment processor fallback está respondendo"
else
    print_warning "Payment processor fallback não está respondendo"
fi

echo ""
print_success "Reset das bases de dados concluído!"
echo ""
print_status "Resumo do reset:"
echo "  - Redis: Limpo (cache zerado)"
echo "  - Base principal: Limpa via DELETE /payments"
echo "  - Payment Processor Default: Limpo via /admin/purge-payments"
echo "  - Payment Processor Fallback: Limpo via /admin/purge-payments"
echo "  - Workers: Reiniciados (estado em memória limpo)"
echo ""
print_status "Para executar testes: ./test-api.sh"
print_status "Para teste de carga: ./stress-test.sh [usuarios] [requests_por_usuario]"
