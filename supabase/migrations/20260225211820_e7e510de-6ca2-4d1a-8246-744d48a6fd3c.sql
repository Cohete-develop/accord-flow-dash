-- Add super_admin UPDATE and DELETE policies for acuerdos
CREATE POLICY "Super admin update all acuerdos"
ON public.acuerdos FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin delete all acuerdos"
ON public.acuerdos FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Add super_admin UPDATE and DELETE policies for pagos
CREATE POLICY "Super admin update all pagos"
ON public.pagos FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin delete all pagos"
ON public.pagos FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Add super_admin UPDATE and DELETE policies for entregables
CREATE POLICY "Super admin update all entregables"
ON public.entregables FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin delete all entregables"
ON public.entregables FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Add super_admin UPDATE and DELETE policies for kpis
CREATE POLICY "Super admin update all kpis"
ON public.kpis FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin delete all kpis"
ON public.kpis FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Also add super_admin INSERT policies for all tables
CREATE POLICY "Super admin insert acuerdos"
ON public.acuerdos FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin insert pagos"
ON public.pagos FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin insert entregables"
ON public.entregables FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin insert kpis"
ON public.kpis FOR INSERT
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));