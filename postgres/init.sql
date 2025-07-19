CREATE TABLE processed_payments (
    id SERIAL PRIMARY KEY,
    correlation_id UUID NOT NULL UNIQUE,
    amount NUMERIC(10, 2) NOT NULL,
    processed_by VARCHAR(10) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_payments_summary ON processed_payments (processed_by, processed_at);

-- Remover isso aqui na versão final
INSERT INTO processed_payments (correlation_id, amount, processed_by, processed_at) VALUES
(gen_random_uuid(), 100.50, 'default', NOW()),
(gen_random_uuid(), 75.20, 'fallback', NOW());
