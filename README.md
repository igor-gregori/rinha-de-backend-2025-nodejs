# 🏆 Rinha de Backend 2025 - Solução Node.js Otimizada

Uma implementação otimizada em Node.js para a Rinha de Backend 2025, focada em alta performance e resiliência.

## 🚀 Arquitetura

- **Nginx**: Load balancer com otimizações de performance
- **Payment Proxy** (2 instâncias): API que recebe pagamentos e os envia para fila
- **Payment Worker** (2 instâncias): Processa pagamentos com circuit breaker e fallback inteligente
- **Payment Life Checker**: Monitora saúde dos processadores com cache inteligente
- **PostgreSQL**: Banco de dados com índices otimizados
- **Redis**: Cache e fila de processamento

## 🔧 Características Otimizadas

### ⚡ Performance

- **Cache inteligente** no life checker (4.8s TTL para respeitar rate limit)
- **Circuit breaker pattern** para evitar tentativas desnecessárias
- **Estratégia de roteamento otimizada** (default processor prioritário + margem de 12%)
- **Pool de conexões** otimizado para PostgreSQL
- **Nginx** com keepalive e least connections

### 🛡️ Resiliência

- **Fallback automático** entre processadores
- **Retry logic** com backoff exponencial
- **Health monitoring** contínuo dos serviços
- **Graceful shutdown** em todos os serviços

### 📊 Monitoramento

- Scripts de deploy e monitoramento automatizados
- Logs estruturados para debug
- Métricas de performance em tempo real

## 🛠️ Como Usar

### Deploy Rápido

```bash
# Deploy completo
./deploy.sh

# Deploy com limpeza de volumes
./deploy.sh --clean
```

### Monitoramento

```bash
# Monitoramento básico
./monitor.sh

# Monitoramento com logs
./monitor.sh --logs
```

### Testes

```bash
# Teste da API
./test-api.sh
```

### Comandos Docker Compose

```bash
# Iniciar serviços
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar serviços
docker-compose down

# Ver status
docker-compose ps
```

## 📡 Endpoints

### POST /payments

Envia um pagamento para processamento.

```json
{
  "correlationId": "uuid",
  "amount": 100.5,
  "requestedAt": "2025-01-01T00:00:00Z"
}
```

### GET /payments-summary

Retorna resumo dos pagamentos processados.

```json
{
  "default": {
    "totalRequests": 10,
    "totalAmount": 1000.5
  },
  "fallback": {
    "totalRequests": 5,
    "totalAmount": 500.25
  }
}
```

### GET /payments-summary?from=2025-01-01&to=2025-01-02

Resumo filtrado por período.

### GET /healthcheck

Health check da API.

## 🔍 Estratégia de Processamento

1. **Verificação de Status**: Life checker monitora processadores a cada 5s
2. **Circuit Breaker**: Evita tentativas em processadores com falhas recorrentes
3. **Roteamento Inteligente**:
   - Prioriza processador default (menor taxa)
   - Usa fallback se default indisponível ou muito lento
   - Margem de 12% para escolha entre processadores
4. **Retry Logic**: Até 20 tentativas com backoff de 500ms

## 📈 Otimizações Implementadas

### Base de Dados

- Índices otimizados para queries de resumo
- Pool de conexões com timeouts configurados
- Configurações de performance PostgreSQL

### Cache e Fila

- Redis para cache de status e fila de jobs
- TTL inteligente para respeitar rate limits
- Concorrência de 100 workers por instância

### Nginx

- Least connections load balancing
- Gzip compression
- Keepalive connections
- Timeouts otimizados

### Circuit Breaker

- Threshold de 5 falhas consecutivas
- Timeout de 30s para recuperação
- Reset automático após período de timeout

## 🐳 Recursos Docker

### Limites de CPU/Memória

- **Nginx**: 0.2 CPU, 20MB RAM
- **Payment Proxy**: 0.5 CPU, 100MB RAM (cada)
- **Payment Worker**: 2 CPU, 400MB RAM (cada)
- **Life Checker**: 0.2 CPU, 40MB RAM
- **PostgreSQL**: 2 CPU, 300MB RAM
- **Redis**: 2 CPU, 300MB RAM

**Total**: ~8 CPU, ~1.5GB RAM

## 📝 Logs e Debug

```bash
# Ver logs específicos
docker-compose logs payment-worker-one
docker-compose logs payment-life-checker
docker-compose logs nginx

# Seguir logs em tempo real
docker-compose logs -f --tail=50
```

## 🔧 Configurações Avançadas

### Variáveis de Ambiente

- `PAYMENT_PROCESSOR_URL_DEFAULT`: URL do processador principal
- `PAYMENT_PROCESSOR_URL_FALLBACK`: URL do processador de fallback
- `WATCH_FILES`: Para desenvolvimento (0=produção, 1=dev)

### Tuning de Performance

- Ajustar `concurrency` nos workers conforme CPU disponível
- Modificar pool sizes do PostgreSQL conforme carga
- Configurar keepalive do Nginx para sua carga específica

## 🏁 Resultados Esperados

- ✅ Alta throughput com baixa latência
- ✅ Resiliência a falhas dos processadores
- ✅ Uso eficiente de recursos (CPU/RAM)
- ✅ Consistência nos dados de auditoria
- ✅ Minimização de taxas (priorizando processador default)

---

**Desenvolvido para a Rinha de Backend 2025** 🏆
