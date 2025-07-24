#!/bin/bash

BASE_URL="http://localhost:9999"

echo "🧪 Testando API da Rinha de Backend 2025"
echo "========================================"

# Teste 1: Health check
echo "1️⃣ Testando health check..."
response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/healthcheck")
if [[ "$response" == "200" ]]; then
    echo "✅ Health check: OK"
else
    echo "❌ Health check: FAIL (HTTP $response)"
fi

# Teste 2: Enviar pagamento
echo "2️⃣ Enviando pagamento de teste..."
payment_data='{
    "correlationId": "'$(uuidgen)'",
    "amount": 100.50,
    "requestedAt": "'$(date -Iseconds)'"
}'

response=$(curl -s -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "$payment_data" \
    -o /dev/null \
    "$BASE_URL/payments")

if [[ "$response" == "201" ]]; then
    echo "✅ Pagamento enviado: OK"
else
    echo "❌ Pagamento enviado: FAIL (HTTP $response)"
fi

# Aguardar processamento
echo "⏳ Aguardando processamento (5s)..."
sleep 5

# Teste 3: Verificar resumo de pagamentos
echo "3️⃣ Verificando resumo de pagamentos..."
response=$(curl -s "$BASE_URL/payments-summary")
http_code=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/payments-summary")

if [[ "$http_code" == "200" ]]; then
    echo "✅ Resumo de pagamentos: OK"
    echo "📊 Dados: $response"
else
    echo "❌ Resumo de pagamentos: FAIL (HTTP $http_code)"
fi

# Teste 4: Teste de carga leve
echo "4️⃣ Teste de carga leve (10 pagamentos simultâneos)..."
for i in {1..10}; do
    (
        payment_data='{
            "correlationId": "'$(uuidgen)'",
            "amount": '$((RANDOM % 1000 + 1))',
            "requestedAt": "'$(date -Iseconds)'"
        }'
        curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "$payment_data" \
            "$BASE_URL/payments" > /dev/null
    ) &
done

wait
echo "✅ Teste de carga: Concluído"

echo ""
echo "🏁 Testes finalizados!"
echo "💡 Para monitoramento contínuo, execute: ./monitor.sh"
