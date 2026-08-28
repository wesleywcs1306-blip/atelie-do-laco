ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pago_em TIMESTAMPTZ;

UPDATE public.orders
   SET pago_em = COALESCE(criado, NOW())
 WHERE pago = 'pago'
   AND pago_em IS NULL;
