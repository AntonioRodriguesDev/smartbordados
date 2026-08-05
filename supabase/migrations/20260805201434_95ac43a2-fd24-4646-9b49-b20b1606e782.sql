ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS nota_retorno text;

CREATE TABLE public.price_list (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  modelo text NOT NULL,
  servico text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data_inclusao date NOT NULL DEFAULT CURRENT_DATE,
  data_alteracao_preco date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_list TO authenticated;
GRANT ALL ON public.price_list TO service_role;

ALTER TABLE public.price_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own price_list all" ON public.price_list FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_price_list_updated_at BEFORE UPDATE ON public.price_list
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();