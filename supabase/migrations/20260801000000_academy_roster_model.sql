-- ═══════════════════════════════════════════════════════════════════════
-- Migra academy.* del modelo "1 profile = 1 login (auth.users)" a un
-- modelo roster tipo public.client_closers: cada alumno es una fila con
-- client_id + nombre, sin cuenta de auth propia. El progreso se carga
-- desde la sesión del cliente dueño (Raúl, Adolfo, etc.), no desde una
-- sesión individual del vendedor.
--
-- NO SE MIGRAN DATOS de academy.profiles/user_roles: el schema academy
-- recién migrado solo tiene contenido default (3 módulos), sin progreso
-- real de ningún alumno.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. academy.team_members ───────────────────────────────────────────
-- Mismo patrón que public.client_closers (id, client_id, nombre, activo).
-- FK cross-schema a public.clients: válido porque academy.* y public.*
-- viven en el mismo proyecto de Supabase.

CREATE TABLE academy.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role academy.app_role,                  -- ahora es descriptivo (setter/closer/manager), no de permisos
  status academy.setter_status NOT NULL DEFAULT 'capacitacion',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE academy.team_members IS
  'Roster de alumnos de la Academia por cliente. Sin cuenta de auth propia — '
  'el progreso se carga desde la sesión del cliente dueño (client_id).';

-- ─── 2. Backfill: 1 fila "yo mismo" por cada cliente activo existente ──
-- La mayoría de los clientes de Torii no tienen equipo — el cliente mismo
-- es el único closer. Por eso arranca sembrado con el dueño como alumno.

INSERT INTO academy.team_members (client_id, full_name, status, active)
SELECT id, name, 'setter_oficial', true
FROM public.clients
WHERE status = 'active';

-- ─── 3. Trigger: todo cliente nuevo siembra su propia fila ─────────────
-- De acá en adelante, cada INSERT en public.clients crea automáticamente
-- el team_member "el dueño mismo" — sin depender de que alguien lo cargue
-- a mano. Los clientes con equipo real (Adolfo, Raúl) simplemente después
-- tienen más filas: la propia + las de sus agentes.

CREATE OR REPLACE FUNCTION public.handle_new_client_seed_team_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, academy
AS $$
BEGIN
  INSERT INTO academy.team_members (client_id, full_name, status, active)
  VALUES (NEW.id, NEW.name, 'setter_oficial', true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_client_created_seed_team_member
  AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_client_seed_team_member();

-- ─── 4. Migrar las 5 FKs de progreso: user_id (auth.users) → team_member_id ──
-- Se vacían primero (sin datos reales que migrar, confirmado) para que el
-- ALTER no falle por filas cuyo user_id no tiene team_member equivalente.

TRUNCATE academy.module_access, academy.video_progress,
  academy.reflection_tasks, academy.exam_submissions, academy.formacion_access;

ALTER TABLE academy.module_access RENAME COLUMN user_id TO team_member_id;
ALTER TABLE academy.module_access DROP CONSTRAINT IF EXISTS module_access_user_id_fkey;
ALTER TABLE academy.module_access ADD CONSTRAINT module_access_team_member_id_fkey
  FOREIGN KEY (team_member_id) REFERENCES academy.team_members(id) ON DELETE CASCADE;

ALTER TABLE academy.video_progress RENAME COLUMN user_id TO team_member_id;
ALTER TABLE academy.video_progress DROP CONSTRAINT IF EXISTS video_progress_user_id_fkey;
ALTER TABLE academy.video_progress ADD CONSTRAINT video_progress_team_member_id_fkey
  FOREIGN KEY (team_member_id) REFERENCES academy.team_members(id) ON DELETE CASCADE;

ALTER TABLE academy.reflection_tasks RENAME COLUMN user_id TO team_member_id;
ALTER TABLE academy.reflection_tasks DROP CONSTRAINT IF EXISTS reflection_tasks_user_id_fkey;
ALTER TABLE academy.reflection_tasks ADD CONSTRAINT reflection_tasks_team_member_id_fkey
  FOREIGN KEY (team_member_id) REFERENCES academy.team_members(id) ON DELETE CASCADE;

ALTER TABLE academy.exam_submissions RENAME COLUMN user_id TO team_member_id;
ALTER TABLE academy.exam_submissions DROP CONSTRAINT IF EXISTS exam_submissions_user_id_fkey;
ALTER TABLE academy.exam_submissions ADD CONSTRAINT exam_submissions_team_member_id_fkey
  FOREIGN KEY (team_member_id) REFERENCES academy.team_members(id) ON DELETE CASCADE;

-- formacion_access.user_id nunca tuvo FK real (bug del schema original) —
-- ahora sí queda con FK de verdad.
ALTER TABLE academy.formacion_access RENAME COLUMN user_id TO team_member_id;
ALTER TABLE academy.formacion_access ADD CONSTRAINT formacion_access_team_member_id_fkey
  FOREIGN KEY (team_member_id) REFERENCES academy.team_members(id) ON DELETE CASCADE;

-- ─── 5. Sacar todas las policies que dependen de has_role() ────────────
-- Hace falta antes de poder borrar la función. Se recrean en la sección 8.

DROP POLICY IF EXISTS "Admins can read all submissions" ON academy.exam_submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON academy.exam_submissions;
DROP POLICY IF EXISTS "Users can manage own submissions" ON academy.exam_submissions;

DROP POLICY IF EXISTS "Admins can read all reflections" ON academy.reflection_tasks;
DROP POLICY IF EXISTS "Admins can update reflections" ON academy.reflection_tasks;
DROP POLICY IF EXISTS "Users can manage own reflections" ON academy.reflection_tasks;

DROP POLICY IF EXISTS "Admins can read all progress" ON academy.video_progress;
DROP POLICY IF EXISTS "Users can manage own progress" ON academy.video_progress;

DROP POLICY IF EXISTS "Admins can manage access" ON academy.module_access;
DROP POLICY IF EXISTS "Users can read own access" ON academy.module_access;

DROP POLICY IF EXISTS "Admins can manage formacion access" ON academy.formacion_access;
DROP POLICY IF EXISTS "Users can read own formacion access" ON academy.formacion_access;

DROP POLICY IF EXISTS "Admins can manage questions" ON academy.exam_questions;
DROP POLICY IF EXISTS "Authenticated can read questions" ON academy.exam_questions;

DROP POLICY IF EXISTS "Admins can manage exams" ON academy.exams;
DROP POLICY IF EXISTS "Authenticated can read exams" ON academy.exams;

DROP POLICY IF EXISTS "Admins can manage formaciones" ON academy.formaciones;
DROP POLICY IF EXISTS "Authenticated can read formaciones" ON academy.formaciones;

DROP POLICY IF EXISTS "Admins can manage modules" ON academy.modules;
DROP POLICY IF EXISTS "Authenticated can read modules" ON academy.modules;

DROP POLICY IF EXISTS "Admins can manage materials" ON academy.module_materials;
DROP POLICY IF EXISTS "Authenticated can read materials" ON academy.module_materials;

DROP POLICY IF EXISTS "Admins can manage videos" ON academy.videos;
DROP POLICY IF EXISTS "Authenticated can read videos" ON academy.videos;

-- profiles y user_roles se borran enteros en la sección 6 (DROP TABLE se
-- lleva sus policies con ellas), pero se dropean explícito acá también
-- para no depender de ese efecto implícito.
DROP POLICY IF EXISTS "Admins can read all profiles" ON academy.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON academy.profiles;
DROP POLICY IF EXISTS "Admins can manage roles" ON academy.user_roles;

-- storage.objects (bucket module-materials) también usa has_role() — se repuntea.
-- El nombre real en la DB quedó como "Academy admins can manage materials"
-- (distinto del nombre original "Admins can manage materials" de la migración
-- de torii-academy — se ve que se renombró al mover el schema, probablemente
-- para no chocar con policies de otro bucket/app en el mismo proyecto). Sin
-- este DROP puntual, el DROP FUNCTION academy.has_role() de más abajo falla
-- porque esta policy todavía la referencia.
DROP POLICY IF EXISTS "Academy admins can manage materials" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage materials" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read materials" ON storage.objects;

-- blog_posts queda FUERA de esta migración por decisión explícita — pero su
-- policy de admin depende de has_role(), así que se repuntea (mínimo
-- necesario para poder borrar la función; no se toca nada más de blog_posts).
DROP POLICY IF EXISTS "Admins can manage blog posts" ON academy.blog_posts;

-- ─── 6. Borrar profiles, user_roles y has_role() ───────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS academy.handle_new_user();

DROP TABLE IF EXISTS academy.profiles;
DROP TABLE IF EXISTS academy.user_roles;
DROP FUNCTION IF EXISTS academy.has_role(uuid, academy.app_role);

-- ─── 7. Funciones nuevas de autorización ───────────────────────────────
-- is_portal_admin(): mismo criterio que el resto del Admin del Portal
-- (profiles.role = 'admin'), no un rol propio de la Academia.
-- is_own_client(): ¿el client_id pasado le pertenece al auth.uid() actual?
-- Mismo mecanismo que ya usa client_closer_calls (clients.profile_id).

CREATE OR REPLACE FUNCTION academy.is_portal_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION academy.is_own_client(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients WHERE id = _client_id AND profile_id = auth.uid()
  )
$$;

-- ─── 8. RLS nueva ───────────────────────────────────────────────────────

ALTER TABLE academy.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage team members" ON academy.team_members
  FOR ALL USING (academy.is_portal_admin()) WITH CHECK (academy.is_portal_admin());
CREATE POLICY "Clients can manage own team members" ON academy.team_members
  FOR ALL USING (academy.is_own_client(client_id)) WITH CHECK (academy.is_own_client(client_id));

-- Progreso (module_access, video_progress, reflection_tasks, exam_submissions,
-- formacion_access): mismo criterio, vía join a team_members para el client_id.

CREATE POLICY "Admins can manage module access" ON academy.module_access
  FOR ALL USING (academy.is_portal_admin()) WITH CHECK (academy.is_portal_admin());
CREATE POLICY "Clients can manage own team module access" ON academy.module_access
  FOR ALL USING (EXISTS (
    SELECT 1 FROM academy.team_members tm
    WHERE tm.id = module_access.team_member_id AND academy.is_own_client(tm.client_id)
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM academy.team_members tm
    WHERE tm.id = module_access.team_member_id AND academy.is_own_client(tm.client_id)
  ));

CREATE POLICY "Admins can manage video progress" ON academy.video_progress
  FOR ALL USING (academy.is_portal_admin()) WITH CHECK (academy.is_portal_admin());
CREATE POLICY "Clients can manage own team video progress" ON academy.video_progress
  FOR ALL USING (EXISTS (
    SELECT 1 FROM academy.team_members tm
    WHERE tm.id = video_progress.team_member_id AND academy.is_own_client(tm.client_id)
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM academy.team_members tm
    WHERE tm.id = video_progress.team_member_id AND academy.is_own_client(tm.client_id)
  ));

CREATE POLICY "Admins can manage reflection tasks" ON academy.reflection_tasks
  FOR ALL USING (academy.is_portal_admin()) WITH CHECK (academy.is_portal_admin());
CREATE POLICY "Clients can manage own team reflection tasks" ON academy.reflection_tasks
  FOR ALL USING (EXISTS (
    SELECT 1 FROM academy.team_members tm
    WHERE tm.id = reflection_tasks.team_member_id AND academy.is_own_client(tm.client_id)
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM academy.team_members tm
    WHERE tm.id = reflection_tasks.team_member_id AND academy.is_own_client(tm.client_id)
  ));

CREATE POLICY "Admins can manage exam submissions" ON academy.exam_submissions
  FOR ALL USING (academy.is_portal_admin()) WITH CHECK (academy.is_portal_admin());
CREATE POLICY "Clients can manage own team exam submissions" ON academy.exam_submissions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM academy.team_members tm
    WHERE tm.id = exam_submissions.team_member_id AND academy.is_own_client(tm.client_id)
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM academy.team_members tm
    WHERE tm.id = exam_submissions.team_member_id AND academy.is_own_client(tm.client_id)
  ));

CREATE POLICY "Admins can manage formacion access" ON academy.formacion_access
  FOR ALL USING (academy.is_portal_admin()) WITH CHECK (academy.is_portal_admin());
CREATE POLICY "Clients can manage own team formacion access" ON academy.formacion_access
  FOR ALL USING (EXISTS (
    SELECT 1 FROM academy.team_members tm
    WHERE tm.id = formacion_access.team_member_id AND academy.is_own_client(tm.client_id)
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM academy.team_members tm
    WHERE tm.id = formacion_access.team_member_id AND academy.is_own_client(tm.client_id)
  ));

-- Contenido (formaciones, modules, videos, module_materials, exams,
-- exam_questions): todos los clientes ven el mismo contenido, solo el
-- admin del Portal lo administra.

CREATE POLICY "Admins can manage formaciones" ON academy.formaciones
  FOR ALL USING (academy.is_portal_admin()) WITH CHECK (academy.is_portal_admin());
CREATE POLICY "Authenticated can read formaciones" ON academy.formaciones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage modules" ON academy.modules
  FOR ALL USING (academy.is_portal_admin()) WITH CHECK (academy.is_portal_admin());
CREATE POLICY "Authenticated can read modules" ON academy.modules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage videos" ON academy.videos
  FOR ALL USING (academy.is_portal_admin()) WITH CHECK (academy.is_portal_admin());
CREATE POLICY "Authenticated can read videos" ON academy.videos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage materials" ON academy.module_materials
  FOR ALL USING (academy.is_portal_admin()) WITH CHECK (academy.is_portal_admin());
CREATE POLICY "Authenticated can read materials" ON academy.module_materials
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage exams" ON academy.exams
  FOR ALL USING (academy.is_portal_admin()) WITH CHECK (academy.is_portal_admin());
CREATE POLICY "Authenticated can read exams" ON academy.exams
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage questions" ON academy.exam_questions
  FOR ALL USING (academy.is_portal_admin()) WITH CHECK (academy.is_portal_admin());
CREATE POLICY "Authenticated can read questions" ON academy.exam_questions
  FOR SELECT TO authenticated USING (true);

-- storage.objects (bucket module-materials): mismo criterio, repunteado.
CREATE POLICY "Authenticated can read materials" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'module-materials');
CREATE POLICY "Admins can manage materials" ON storage.objects
  FOR ALL TO authenticated USING (
    bucket_id = 'module-materials' AND academy.is_portal_admin()
  ) WITH CHECK (
    bucket_id = 'module-materials' AND academy.is_portal_admin()
  );

-- blog_posts: fuera de alcance — se repuntea solo la policy de admin
-- (mínimo necesario para poder borrar has_role()), nada más se toca.
CREATE POLICY "Admins can manage blog posts" ON academy.blog_posts
  FOR ALL USING (academy.is_portal_admin()) WITH CHECK (academy.is_portal_admin());
