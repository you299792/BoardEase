# 🔍 Image Upload Troubleshooting Guide

## Issue: Images not visible in BoardingHouseCard and boarding-house-details

### ✅ What's Already Fixed:
1. ✅ Image upload function uses `uploadListingImage` which uploads to Supabase Storage
2. ✅ Public URLs are generated and returned
3. ✅ Display components filter for valid HTTPS URLs only
4. ✅ Comprehensive logging added throughout the pipeline

### 🔧 Checklist to Verify:

#### 1. Supabase Storage Bucket Configuration
Go to your Supabase dashboard and verify:
- [ ] Bucket named `profile-images` exists
- [ ] Bucket is set to **PUBLIC** (not private)
- [ ] RLS (Row Level Security) policies allow public read access

**How to check:**
1. Go to: https://app.supabase.com/project/rhesmsdrwpxmyeujxlha/storage/buckets
2. Find `profile-images` bucket
3. Click settings (gear icon)
4. Ensure "Public bucket" is **enabled**
5. Check policies tab - should have SELECT policy for `anon` role

#### 2. Test Image Upload
When you upload an image in create-listing:
- [ ] Check console for: `[pickImage] Selected image URI`
- [ ] Check for: `[uploadListingImage] Upload successful`
- [ ] Check for: `[uploadListingImage] Public URL:` - should show full HTTPS URL
- [ ] Verify URL format: `https://rhesmsdrwpxmyeujxlha.supabase.co/storage/v1/object/public/profile-images/...`

#### 3. Test Listing Creation
After submitting a listing:
- [ ] Check console for: `[validateAndSubmit] Photos array` - should show HTTPS URLs
- [ ] Check for: `[createListing] Listing payload` - should include images array
- [ ] Verify no errors during database insert

#### 4. Test Image Display
When viewing a listing:
- [ ] Check console for: `[BoardingHouseCard] Images:` - should show HTTPS URLs
- [ ] Check for: `[BoardingHouseCard] Valid image found:` - should show URL
- [ ] Check for: `[getHouseImages] House images:` - should show URLs from database

### 🐛 Common Issues:

#### Issue 1: Bucket doesn't exist
**Solution:** Create bucket named `profile-images` in Supabase Storage

#### Issue 2: Bucket is private
**Solution:** Make bucket public:
```sql
-- In Supabase SQL Editor
UPDATE storage.buckets 
SET public = true 
WHERE name = 'profile-images';
```

#### Issue 3: RLS blocking access
**Solution:** Add policy for public read:
```sql
-- In Supabase SQL Editor  
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-images');
```

#### Issue 4: Images array has local URIs
**Symptom:** Console shows `file://` URIs instead of `https://`
**Solution:** Already fixed - `pickImage` now uploads immediately

#### Issue 5: Network errors
**Symptom:** `gateway error: Network connection lost`
**Solution:** 
- Check internet connection
- Verify Supabase project is active (not paused)
- Try accessing: https://rhesmsdrwpxmyeujxlha.supabase.co (should load)

### 📊 Diagnostic SQL Queries

Run these in Supabase SQL Editor to check data:

```sql
-- Check if images are being saved with HTTPS URLs
SELECT id, title, images 
FROM listings 
ORDER BY created_at DESC 
LIMIT 5;

-- Check storage bucket configuration
SELECT * FROM storage.buckets WHERE name = 'profile-images';

-- Check storage files
SELECT * FROM storage.objects 
WHERE bucket_id = 'profile-images' 
ORDER BY created_at DESC 
LIMIT 10;
```

### 🔄 Quick Fix Steps:

1. **Restart Metro bundler:**
   ```bash
   npx expo start --clear
   ```

2. **Check Supabase bucket:**
   - Ensure `profile-images` bucket exists and is PUBLIC

3. **Test upload:**
   - Create a listing with an image
   - Check console logs for the full flow
   - Share any error messages you see

4. **Verify database:**
   - Check if listing was created with images array containing HTTPS URLs

### 💡 Expected Console Output (Success):

```
[pickImage] Selected image URI: file:///data/user/0/.../image.jpg
[uploadListingImage] Starting upload for URI: file://...
[uploadListingImage] Image fetched, size: 234567 bytes
[uploadListingImage] Upload successful, filePath: abc123/listings/1234567-listing.jpg
[uploadListingImage] Public URL: https://rhesmsdrwpxmyeujxlha.supabase.co/storage/v1/object/public/profile-images/abc123/listings/1234567-listing.jpg
[pickImage] Upload result: { success: true, publicUrl: "https://..." }
[pickImage] Adding public URL to state: https://...
[pickImage] Updated photos state: ["https://..."]
[validateAndSubmit] Photos array: ["https://..."]
[createListing] Listing payload: {..., images: ["https://..."]}
[BoardingHouseCard] Images: ["https://..."]
[BoardingHouseCard] Valid image found: https://...
```

### 📞 Next Steps:

1. Try creating a listing with an image
2. Share the console output (especially the `[uploadListingImage]` and `[pickImage]` logs)
3. Check if the images array in the database has HTTPS URLs
4. Verify the Supabase storage bucket is public

The logging will tell us exactly where the issue is! 🔍
