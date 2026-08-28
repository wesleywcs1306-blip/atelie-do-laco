-- ============================================================
-- ATELIE DO LACO — Migracao v11 (data de pagamento)
-- Execute este arquivo no SQL Editor do seu projeto Supabase
-- Acesse: https://supabase.com/dashboard -> SQL Editor -> New query
-- ============================================================
-- O QUE FAZ:
--   1. Adiciona a coluna pago_em (timestamp) na tabela orders
--   2. Preenche pago_em com a data de criacao para pedidos
--      ja marcados como "pago" (backfill historico)
-- ============================================================

-- 1. Adicionar coluna pago_em (se ainda nao existir)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pago_em TIMESTAMPTZ;

-- 2. Backfill: pedidos ja pagos sem data herdam a data de criacao
UPDATE public.orders
   SET pago_em = COALESCE(criado, NOW())
 WHERE pago = 'pago'
   AND pago_em IS NULL;

-- ============================================================
-- PRONTO! Agora os calculos financeiros vao usar a data
-- em que o pagamento foi confirmado (pago_em) em vez da
-- data de criacao do pedido.
-- ============================================================
