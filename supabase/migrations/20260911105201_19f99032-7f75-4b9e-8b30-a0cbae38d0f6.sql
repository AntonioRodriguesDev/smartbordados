CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  numero text NOT NULL,
  titulo text,
  contato_nome text,
  contato_email text,
  contato_telefone text,
  responsavel text,
  status text NOT NULL DEFAULT 'rascunho',
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  validade date,
  data_decisao date,
  prazo_entrega text,
  condicao_pagamento text,
  motivo_perda text,
  observacoes text,
  subtotal numeric NOT NULL DEFAULT 0,
  desconto numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  proximo_contato date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quotes all" ON public.quotes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX quotes_user_status_idx ON public.quotes(user_id, status);
CREATE INDEX quotes_client_idx ON public.quotes(client_id);

CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  modelo text NOT NULL,
  servico text,
  quantidade numeric NOT NULL DEFAULT 1,
  valor_unitario numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quote_items all" ON public.quote_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX quote_items_quote_idx ON public.quote_items(quote_id);

CREATE TABLE public.quote_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL DEFAULT 'contato',
  descricao text,
  status_novo text,
  proximo_contato date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_events TO authenticated;
GRANT ALL ON public.quote_events TO service_role;
ALTER TABLE public.quote_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quote_events all" ON public.quote_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX quote_events_quote_idx ON public.quote_events(quote_id);