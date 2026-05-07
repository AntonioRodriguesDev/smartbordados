
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cpf TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  data_nascimento DATE,
  data_admissao DATE,
  cargo TEXT,
  setor TEXT,
  salario NUMERIC NOT NULL DEFAULT 0,
  dia_pagamento INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'ativo',
  foto_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own employees all" ON public.employees FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.employee_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  nome TEXT NOT NULL,
  nivel INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own emp skills all" ON public.employee_skills FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_emp_skills_emp ON public.employee_skills(employee_id);

CREATE TABLE public.employee_vales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  valor NUMERIC NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  descricao TEXT,
  quitado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_vales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own emp vales all" ON public.employee_vales FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_emp_vales_emp ON public.employee_vales(employee_id);

CREATE TABLE public.employee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  valor NUMERIC NOT NULL,
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL DEFAULT 'salario',
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own emp payments all" ON public.employee_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_emp_payments_emp ON public.employee_payments(employee_id);
