CREATE OR REPLACE FUNCTION public.protect_company_plan_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    NEW.plan := OLD.plan;
    NEW.max_seats := OLD.max_seats;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_company_plan ON public.companies;
CREATE TRIGGER trg_protect_company_plan
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.protect_company_plan_fields();