-- A staff member may have a teaching record and still be employed in a non-teaching role.
ALTER TABLE public.school_staff_directory
  DROP CONSTRAINT IF EXISTS school_staff_directory_teacher_category_check;

-- Link older staff login accounts to a directory record only when the name match is unique
-- in both directions within the same school.
WITH candidate_pairs AS (
  SELECT a.id AS account_id, d.id AS staff_member_id
  FROM public.school_staff_accounts a
  JOIN public.school_staff_directory d
    ON d.school_id = a.school_id
   AND lower(regexp_replace(trim(a.display_name), '[[:space:]]+', ' ', 'g'))
       = lower(regexp_replace(trim(d.full_name), '[[:space:]]+', ' ', 'g'))
  WHERE a.staff_member_id IS NULL
), unambiguous_accounts AS (
  SELECT account_id, min(staff_member_id::text)::uuid AS staff_member_id
  FROM candidate_pairs
  GROUP BY account_id
  HAVING count(*) = 1
), unambiguous_members AS (
  SELECT staff_member_id
  FROM unambiguous_accounts
  GROUP BY staff_member_id
  HAVING count(*) = 1
)
UPDATE public.school_staff_accounts a
SET staff_member_id = ua.staff_member_id
FROM unambiguous_accounts ua
JOIN unambiguous_members um ON um.staff_member_id = ua.staff_member_id
WHERE a.id = ua.account_id;
