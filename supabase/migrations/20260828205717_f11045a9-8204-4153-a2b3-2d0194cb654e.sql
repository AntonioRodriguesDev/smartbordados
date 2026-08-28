ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS tipo_pagamento text NOT NULL DEFAULT 'hora',
  ADD COLUMN IF NOT EXISTS valor_hora numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_peca numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ciclo text NOT NULL DEFAULT 'quinzenal',
  ADD COLUMN IF NOT EXISTS ciclo_dia_1 integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS ciclo_dia_2 integer NOT NULL DEFAULT 30;

ALTER TABLE public.employee_vales
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'vale';

CREATE TABLE IF NOT EXISTS public.payroll_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  horas numeric NOT NULL DEFAULT 0,
  pecas numeric NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_entries TO authenticated;
GRANT ALL ON public.payroll_entries TO service_role;
ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payroll_entries all" ON public.payroll_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_payroll_entries_updated_at BEFORE UPDATE ON public.payroll_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  inicio date NOT NULL,
  fim date NOT NULL,
  tipo_pagamento text NOT NULL DEFAULT 'hora',
  quantidade numeric NOT NULL DEFAULT 0,
  valor_unitario numeric NOT NULL DEFAULT 0,
  bruto numeric NOT NULL DEFAULT 0,
  descontos numeric NOT NULL DEFAULT 0,
  adiantamentos numeric NOT NULL DEFAULT 0,
  liquido numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberto',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_periods TO authenticated;
GRANT ALL ON public.payroll_periods TO service_role;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payroll_periods all" ON public.payroll_periods FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_payroll_periods_updated_at BEFORE UPDATE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
