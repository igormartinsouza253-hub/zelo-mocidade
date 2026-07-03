-- Allow every authenticated user to view group photos in the group access flow.
-- The bucket remains private; clients still receive short-lived signed URLs.

DROP POLICY IF EXISTS "Group members can read group photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read group photos" ON storage.objects;

CREATE POLICY "Authenticated users can read group photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'group-photos'
);
