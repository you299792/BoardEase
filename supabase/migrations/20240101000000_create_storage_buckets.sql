-- Create Storage Buckets for BoardEase

-- Create profile-images bucket
INSERT INTO storage.buckets (id, name, owner, public)
VALUES ('profile-images', 'profile-images', NULL, true)
ON CONFLICT (id) DO NOTHING;

-- Create listing-images bucket
INSERT INTO storage.buckets (id, name, owner, public)
VALUES ('listing-images', 'listing-images', NULL, true)
ON CONFLICT (id) DO NOTHING;

-- Create documents bucket
INSERT INTO storage.buckets (id, name, owner, public)
VALUES ('documents', 'documents', NULL, false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for profile-images bucket
CREATE POLICY "Public Access - profile-images" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-images');

CREATE POLICY "Users can upload their own profile images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'profile-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own profile images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'profile-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own profile images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'profile-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Set up RLS policies for listing-images bucket
CREATE POLICY "Public Access - listing-images" ON storage.objects
  FOR SELECT USING (bucket_id = 'listing-images');

CREATE POLICY "Landlords can upload listing images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'listing-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Landlords can update their listing images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'listing-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Landlords can delete their listing images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'listing-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Set up RLS policies for documents bucket
CREATE POLICY "Users can upload their documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
