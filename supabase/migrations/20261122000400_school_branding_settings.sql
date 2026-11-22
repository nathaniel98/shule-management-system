-- Per-school branding assets. School Admins may manage only their own school's assets.
CREATE TABLE IF NOT EXISTS public.school_branding (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  logo_path text,
  letterhead_path text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_branding_read ON public.school_branding;
CREATE POLICY school_branding_read
  ON public.school_branding FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_active_school_admin_for_school(school_id)
  );

DROP POLICY IF EXISTS school_branding_insert ON public.school_branding;
CREATE POLICY school_branding_insert
  ON public.school_branding FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR public.is_active_school_admin_for_school(school_id)
  );

DROP POLICY IF EXISTS school_branding_update ON public.school_branding;
CREATE POLICY school_branding_update
  ON public.school_branding FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_active_school_admin_for_school(school_id)
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.is_active_school_admin_for_school(school_id)
  );

GRANT SELECT, INSERT, UPDATE ON public.school_branding TO authenticated;
REVOKE ALL ON public.school_branding FROM anon;

-- Public read makes school logos and letterheads render in public-facing PDFs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('school-branding', 'school-branding', true, 5242880,
        ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'])
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS school_branding_assets_public_read ON storage.objects;
CREATE POLICY school_branding_assets_public_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'school-branding');

DROP POLICY IF EXISTS school_branding_assets_insert ON storage.objects;
CREATE POLICY school_branding_assets_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'school-branding'
    AND (
      public.is_super_admin()
      OR (
        array_length(storage.foldername(name), 1) >= 1
        AND public.is_active_school_admin_for_school(
          (storage.foldername(name))[1]::uuid
        )
      )
    )
  );

DROP POLICY IF EXISTS school_branding_assets_update ON storage.objects;
CREATE POLICY school_branding_assets_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'school-branding'
    AND (
      public.is_super_admin()
      OR (
        array_length(storage.foldername(name), 1) >= 1
        AND public.is_active_school_admin_for_school(
          (storage.foldername(name))[1]::uuid
        )
      )
    )
  )
  WITH CHECK (
    bucket_id = 'school-branding'
    AND (
      public.is_super_admin()
      OR (
        array_length(storage.foldername(name), 1) >= 1
        AND public.is_active_school_admin_for_school(
          (storage.foldername(name))[1]::uuid
        )
      )
    )
  );

DROP POLICY IF EXISTS school_branding_assets_delete ON storage.objects;
CREATE POLICY school_branding_assets_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'school-branding'
    AND (
      public.is_super_admin()
      OR (
        array_length(storage.foldername(name), 1) >= 1
        AND public.is_active_school_admin_for_school(
          (storage.foldername(name))[1]::uuid
        )
      )
    )
  );
