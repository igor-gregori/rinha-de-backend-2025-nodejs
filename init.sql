CREATE TABLE processed_payments (
    id SERIAL PRIMARY KEY,
    correlation_id UUID NOT NULL UNIQUE,
    amount NUMERIC(10, 2) NOT NULL,
    processed_by VARCHAR(10) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices otimizados para performance
CREATE INDEX idx_payments_summary ON processed_payments (processed_by, processed_at);
CREATE INDEX idx_payments_correlation ON processed_payments (correlation_id);
CREATE INDEX idx_payments_processed_at ON processed_payments (processed_at DESC);

-- Configurações de performance para PostgreSQL
ALTER SYSTEM SET shared_buffers = '64MB';
ALTER SYSTEM SET effective_cache_size = '200MB';
ALTER SYSTEM SET maintenance_work_mem = '16MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '2MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Remover dados de exemplo (comentar na versão final)
-- INSERT INTO processed_payments (correlation_id, amount, processed_by, processed_at) VALUES
-- (gen_random_uuid(), 100.50, 'default', NOW()),
-- (gen_random_uuid(), 75.20, 'fallback', NOW());
