# ⚠️ Implementação descontinuada

Não irei continuar implementando essa solução pois o projeto foi desenvolvido utilizando muitos recursos, a com a restrição da rinha não consegui atingir a performance mínima que eu gostaria.

Irei seguir com uma implementação utilizando menos recursos e com outro runtime.

Você pode conferir nesse repositório.
[https://github.com/igor-gregori/rinha-de-backend-2025-bun](https://github.com/igor-gregori/rinha-de-backend-2025-bun)

# Rinha de Backend 2025 - Node.js

Sistema de processamento de pagamentos distribuído desenvolvido para a Rinha de Backend 2025, implementado em Node.js com arquitetura baseada em microserviços.

## 🏗️ Arquitetura

![Arquitetura do Sistema](arch.svg)

O sistema é composto por múltiplos serviços que trabalham em conjunto para processar pagamentos de forma eficiente e confiável:

- **Payment Proxy**: API Gateway que recebe as requisições de pagamento
- **Payment Worker**: Processa os pagamentos de forma assíncrona
- **Payment Life Checker**: Monitora a saúde dos processadores de pagamento
- **Nginx**: Load balancer para distribuir as requisições
- **PostgreSQL**: Banco de dados principal para armazenar pagamentos processados
- **Redis**: Sistema de filas para comunicação entre serviços

## 🚀 Tecnologias

### Backend

- **Node.js 24** - Runtime JavaScript
- **BullMQ** - Sistema de filas Redis para processamento assíncrono
- **PostgreSQL 17** - Banco de dados relacional
- **Redis** - Cache e sistema de filas
- **IORedis** - Cliente Redis para Node.js

### Infraestrutura

- **Docker & Docker Compose** - Containerização e orquestração
- **Nginx** - Load balancer e proxy reverso
- **Alpine Linux** - Imagens Docker otimizadas

### Dependências Principais

- `pg` - Cliente PostgreSQL
- `bullmq` - Sistema de filas
- `ioredis` - Cliente Redis

## 📋 Pré-requisitos

- Docker
- Docker Compose
- Rede externa `payment-processor` (para integração com processadores de pagamento)

## 🔧 Como Iniciar

### 1. Clone o repositório

```bash
git clone https://github.com/igor-gregori/rinha-de-backend-2025-nodejs.git
cd rinha-de-backend-2025-nodejs
```

### 2. Configure a rede externa (se necessário)

```bash
docker network create payment-processor
```

### 3. Inicie os serviços

```bash
docker-compose up -d
```

### 4. Verifique se os serviços estão rodando

```bash
docker-compose ps
```

## 🛠️ Scripts Disponíveis

O projeto inclui scripts utilitários na pasta `scripts/`:

- `deploy.sh` - Script de deploy / Subir todos os container para usar a solução
- `reset-databases.sh` - Reseta os bancos de dados

## 📊 Monitoramento

### Portas dos Serviços

- **API**: `http://localhost:9999` (Nginx)
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

### Logs dos Containers

```bash
# Ver logs de todos os serviços
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f payment-proxy-one
```

## 🏭 Estrutura dos Serviços

### Payment Proxy

- **Localização**: `./payment-proxy/`
- **Função**: Recebe requisições HTTP e adiciona jobs na fila
- **Instâncias**: 2 (load balanced)

### Payment Worker

- **Localização**: `./payment-worker/`
- **Função**: Processa pagamentos de forma assíncrona
- **Instâncias**: 2 (processamento paralelo)

### Payment Life Checker

- **Localização**: `./payment-life-checker/`
- **Função**: Monitora a saúde dos processadores externos
- **Instâncias**: 1

## 💾 Banco de Dados

### Schema Principal

```sql
CREATE TABLE processed_payments (
    id SERIAL PRIMARY KEY,
    correlation_id UUID NOT NULL UNIQUE,
    amount NUMERIC(10, 2) NOT NULL,
    processed_by VARCHAR(10) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Otimizações

- Índices otimizados para consultas frequentes
- Configurações de performance para PostgreSQL
- Pool de conexões otimizado

## 🔄 Fluxo de Processamento

1. **Requisição**: Cliente envia pagamento para o Nginx
2. **Load Balance**: Nginx distribui para um dos Payment Proxies
3. **Enfileiramento**: Payment Proxy adiciona job na fila Redis
4. **Processamento**: Payment Worker processa o pagamento
5. **Persistência**: Dados são salvos no PostgreSQL
6. **Monitoramento**: Life Checker verifica saúde do sistema

## 📈 Performance

### Limites de Recursos (por container)

- **nginx**: 0.2 CPU, 30MB RAM
- **postgres-backend**: 0.4 CPU, 120MB RAM
- **redis**: 0.2 CPU, 70MB RAM
- **payment-proxy**: 0.1 CPU, 20MB RAM (cada)
- **payment-worker**: 0.2 CPU, 35MB RAM (cada)
- **payment-life-checker**: 0.1 CPU, 20MB RAM

### Total de Recursos

- **CPU**: 1.5 cores
- **Memória**: 350MB

## 🧪 Desenvolvimento

### Modo de Desenvolvimento

Para desenvolvimento com hot-reload, defina `WATCH_FILES=1`:

```bash
# No docker-compose.yml
environment:
  - WATCH_FILES=1
```

### Executar Localmente

```bash
# Para cada serviço
cd payment-proxy
npm install
npm run dev
```

## 📝 API

### Endpoints Principais

- `POST /pagamentos` - Criar novo pagamento
- `GET /summary` - Resumo dos pagamentos processados

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 🎯 Rinha de Backend 2025

Este projeto foi desenvolvido para participar da Rinha de Backend 2025, focando em:

- Alta performance com recursos limitados
- Arquitetura distribuída e escalável
- Processamento assíncrono eficiente
- Otimizações de banco de dados
- Containerização com Docker
