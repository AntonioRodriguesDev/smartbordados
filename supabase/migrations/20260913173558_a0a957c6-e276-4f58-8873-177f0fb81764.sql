ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS valor_diaria numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_mensal numeric NOT NULL DEFAULT 0;

ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS valor_unitario numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dias numeric NOT NULL DEFAULT 0;

ALTER TABLE public.payroll_periods
  ADD COLUMN IF NOT EXISTS emprestimos numeric NOT NULL DEFAULT 0;

ALTER TABLE public.employee_vales
  ADD COLUMN IF NOT EXISTS payroll_period_id uuid;

ALTER TABLE public.employee_payments
  ADD COLUMN IF NOT EXISTS payroll_period_id uuid;

CREATE TABLE IF NOT EXISTS public.employee_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  descricao text,
  valor_total numeric NOT NULL DEFAULT 0,
  parcelas integer NOT NULL DEFAULT 1,
  valor_parcela numeric NOT NULL DEFAULT 0,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'ativo',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_loans TO authenticated;
GRANT ALL ON public.employee_loans TO service_role;
ALTER TABLE public.employee_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own employee_loans all" ON public.employee_loans FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_employee_loans_updated_at BEFORE UPDATE ON public.employee_loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.loan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  loan_id uuid NOT NULL REFERENCES public.employee_loans(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  numero integer NOT NULL DEFAULT 1,
  valor numeric NOT NULL DEFAULT 0,
  competencia date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pendente',
  payroll_period_id uuid,
  pago_em date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_installments TO authenticated;
GRANT ALL ON public.loan_installments TO service_role;
ALTER TABLE public.loan_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own loan_installments all" ON public.loan_installments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_loan_installments_updated_at BEFORE UPDATE ON public.loan_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS loan_installments_emp_idx ON public.loan_installments(employee_id, status);
