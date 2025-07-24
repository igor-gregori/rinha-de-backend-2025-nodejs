#!/bin/bash

BASE_URL="http://localhost:9999"
CONCURRENT_USERS=${1:-50}
REQUESTS_PER_USER=${2:-100}
TOTAL_REQUESTS=$((CONCURRENT_USERS * REQUESTS_PER_USER))

echo "🚀 Teste de Carga Avançado - Rinha de Backend 2025"
echo "=================================================="
echo "Usuários simultâneos: $CONCURRENT_USERS"
echo "Requisições por usuário: $REQUESTS_PER_USER"
echo "Total de requisições: $TOTAL_REQUESTS"
echo ""

# Função para enviar requisições
send_requests() {
    local user_id=$1
    local requests=$2
    local success=0
    local errors=0
    local timeouts=0
    local start_time=$(date +%s%N)
    
    for ((i=1; i<=requests; i++)); do
        payment_data='{
            "correlationId": "'$(uuidgen)'",
            "amount": '$((RANDOM % 1000 + 1))',
            "requestedAt": "'$(date -Iseconds)'"
        }'
        
        response=$(curl -s -w "%{http_code}:%{time_total}" \
            --max-time 10 \
            -X POST \
            -H "Content-Type: application/json" \
            -d "$payment_data" \
            "$BASE_URL/payments" 2>/dev/null)
        
        if [[ $? -eq 0 ]]; then
            http_code=$(echo "$response" | cut -d':' -f1)
            response_time=$(echo "$response" | cut -d':' -f2)
            
            if [[ "$http_code" == "201" ]]; then
                ((success++))
            else
                ((errors++))
                echo "User $user_id: HTTP $http_code" >&2
            fi
        else
            ((timeouts++))
            echo "User $user_id: Timeout/Error" >&2
        fi
        
        # Pequeno delay para simular uso real
        sleep 0.01
    done
    
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 )) # em ms
    
    echo "User $user_id: $success success, $errors errors, $timeouts timeouts in ${duration}ms"
}

# Verificar se API está funcionando
echo "🔍 Verificando se API está respondendo..."
if ! curl -sf "$BASE_URL/healthcheck" > /dev/null; then
    echo "❌ API não está respondendo. Verifique se os serviços estão rodando."
    exit 1
fi
echo "✅ API está respondendo"
echo ""

# Limpar dados anteriores
echo "🧹 Limpando dados anteriores..."
curl -s -X DELETE "$BASE_URL/payments" > /dev/null

echo "🚀 Iniciando teste de carga..."
start_test=$(date +%s)

# Executar requisições em paralelo
pids=()
for ((user=1; user<=CONCURRENT_USERS; user++)); do
    send_requests $user $REQUESTS_PER_USER &
    pids+=($!)
done

echo "⏳ Aguardando conclusão de todos os usuários..."

# Aguardar todos os processos
for pid in "${pids[@]}"; do
    wait $pid
done

end_test=$(date +%s)
test_duration=$((end_test - start_test))

echo ""
echo "✅ Teste concluído em ${test_duration}s"

# Aguardar processamento
echo "⏳ Aguardando processamento das filas (10s)..."
sleep 10

# Verificar resultados
echo "📊 Verificando resultados..."
summary=$(curl -s "$BASE_URL/payments-summary")
echo "Resumo de pagamentos processados:"
echo "$summary" | jq . 2>/dev/null || echo "$summary"

# Calcular estatísticas
total_processed=$(echo "$summary" | jq -r '.default.totalRequests + .fallback.totalRequests' 2>/dev/null || echo "N/A")
throughput=$(echo "scale=2; $TOTAL_REQUESTS / $test_duration" | bc -l 2>/dev/null || echo "N/A")

echo ""
echo "📈 Estatísticas do Teste:"
echo "Total enviado: $TOTAL_REQUESTS"
echo "Total processado: $total_processed"
echo "Duração: ${test_duration}s"
echo "Throughput: ${throughput} req/s"

if [[ "$total_processed" != "N/A" && $total_processed -ge $((TOTAL_REQUESTS * 95 / 100)) ]]; then
    echo "✅ Teste PASSOU: >95% dos pagamentos foram processados"
else
    echo "❌ Teste FALHOU: Muitos pagamentos não foram processados"
fi

echo ""
echo "💡 Para monitorar em tempo real: ./monitor.sh"
echo "💡 Para ver logs: docker-compose logs -f"
