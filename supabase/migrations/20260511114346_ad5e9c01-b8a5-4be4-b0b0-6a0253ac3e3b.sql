
CREATE TABLE public.cost_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  tipo_padrao text NOT NULL DEFAULT 'fixo',
  cor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cost_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cost_categories all" ON public.cost_categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid REFERENCES public.cost_categories(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'fixo',
  valor numeric NOT NULL DEFAULT 0,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  dia_vencimento integer,
  parcelas_total integer,
  parcelas_pagas integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  pago boolean NOT NULL DEFAULT false,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own costs all" ON public.costs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_costs_user ON public.costs(user_id);
CREATE INDEX idx_costs_category ON public.costs(category_id);
