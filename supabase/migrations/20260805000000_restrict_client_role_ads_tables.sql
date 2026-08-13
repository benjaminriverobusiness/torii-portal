-- Cierra un agujero de RLS: la policy "authenticated no-auditor acceso
-- total" (PERMISSIVE, FOR ALL) en ads_campanas/ads_metricas_diarias le
-- daba acceso total, sin scoping por client_id, a cualquier usuario
-- autenticado que no fuera 'auditor' — incluye a los usuarios con rol
-- 'client' (los clientes del Portal), que podían leer/escribir campañas
-- y métricas de OTROS clientes llamando a la API de Supabase directo.
--
-- No se toca ninguna policy existente (staff/admin/moderator quedan
-- exactamente igual). Se agregan 2 policies RESTRICTIVE nuevas: estas se
-- combinan con AND sobre las PERMISSIVE existentes, así que solo pueden
-- restringir, nunca ampliar acceso. Para cualquier rol que no sea
-- 'client' la condición es `true` automáticamente (no-op). Confirmado en
-- producción que ningún usuario tiene doble rol (client + admin/moderator),
-- así que esto no afecta a nadie del staff ni a torii-hub (que usa la
-- misma anon key, sujeta a RLS, no un service_role que la bypasee).
--
-- Aplicada ya en producción vía MCP el 2026-08-05.

CREATE POLICY "client solo ve sus propias campañas" ON public.ads_campanas
  AS RESTRICTIVE
  FOR ALL
  USING (
    NOT has_role(auth.uid(), 'client'::app_role)
    OR client_id = (SELECT clients.id FROM clients WHERE clients.profile_id = auth.uid())
  )
  WITH CHECK (
    NOT has_role(auth.uid(), 'client'::app_role)
    OR client_id = (SELECT clients.id FROM clients WHERE clients.profile_id = auth.uid())
  );

CREATE POLICY "client solo ve metricas de sus propias campañas" ON public.ads_metricas_diarias
  AS RESTRICTIVE
  FOR ALL
  USING (
    NOT has_role(auth.uid(), 'client'::app_role)
    OR EXISTS (
      SELECT 1 FROM ads_campanas c
      WHERE c.id = ads_metricas_diarias.campana_id
        AND c.client_id = (SELECT clients.id FROM clients WHERE clients.profile_id = auth.uid())
    )
  )
  WITH CHECK (
    NOT has_role(auth.uid(), 'client'::app_role)
    OR EXISTS (
      SELECT 1 FROM ads_campanas c
      WHERE c.id = ads_metricas_diarias.campana_id
        AND c.client_id = (SELECT clients.id FROM clients WHERE clients.profile_id = auth.uid())
    )
  );
