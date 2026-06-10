# Immediate Actions to Fix All Errors

## Error 1: `profiles` table not found (404 from Supabase)
**Status:** Needs database setup

### Quick Fix - Execute SQL in Supabase Dashboard
1. Dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor** → **New Query**
3. Run this SQL:
   ```sql
   -- Check if is_admin() function exists first
   CREATE OR REPLACE FUNCTION is_admin()
   RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
     SELECT COALESCE(
       (SELECT raw_user_meta_data->>'role' = 'admin'
        FROM auth.users WHERE id = auth.uid()),
       false
     );
   $$;

   -- Create profiles table
   CREATE TABLE IF NOT EXISTS profiles (
     id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     wallet_balance NUMERIC NOT NULL DEFAULT 0.00 CHECK (wallet_balance >= 0)
   );

   -- Enable RLS and create policies
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "admin_all_profiles"    ON profiles FOR ALL    USING (is_admin());
   CREATE POLICY "user_view_profile"     ON profiles FOR SELECT USING (id = auth.uid());
   CREATE POLICY "user_update_profile"   ON profiles FOR UPDATE USING (id = auth.uid());
   CREATE POLICY "user_insert_profile"   ON profiles FOR INSERT WITH CHECK (id = auth.uid());
   ```
4. Click **Run** ✓

---

## Error 2: Razorpay functions returning 404/CORS errors

### Step 1: Fix Netlify Deployment Environment

**In Netlify Dashboard (https://app.netlify.com):**
1. Select your site: `thunderous-paprenjak-6294db`
2. Go to **Site settings** → **Build & deploy** → **Environment**
3. Delete any existing `RAZORPAY_*` vars
4. Add new variables:
   ```
   RAZORPAY_KEY_ID = rzp_test_5pB86mUoQ9t0p1
   RAZORPAY_KEY_SECRET = [Your secret from Razorpay dashboard]
   ```
5. Trigger a deploy: Go to **Deploys** → **Trigger deploy** → **Deploy site**

### Step 2: Fix Supabase Edge Function (Fallback)

**In Supabase Dashboard:**
1. Navigate to **Edge Functions** → `create-razorpay-order`
2. Go to **Settings** tab
3. Add environment variables:
   ```
   RAZORPAY_KEY_ID = rzp_test_5pB86mUoQ9t0p1
   RAZORPAY_KEY_SECRET = [Your secret]
   ```
4. Redeploy the function

OR use CLI:
```bash
cd supabase/functions/create-razorpay-order
supabase secrets set RAZORPAY_KEY_ID=rzp_test_5pB86mUoQ9t0p1
supabase secrets set RAZORPAY_KEY_SECRET=your_secret_here
supabase functions deploy create-razorpay-order
```

---

## Where to Get Razorpay Credentials

1. Go to https://dashboard.razorpay.com/
2. Login
3. Click **Settings** → **API Keys**
4. Copy:
   - **Key ID** (starts with `rzp_test_` or `rzp_live_`)
   - **Key Secret** (hidden by default, click "Show")
5. Use in Netlify & Supabase environment variables

---

## Verification Steps

After applying fixes:

### Step 1: Verify profiles table created
```bash
# In Supabase SQL Editor
SELECT COUNT(*) FROM profiles;
```
Expected: Success (0 rows is fine)

### Step 2: Verify Netlify function works
```bash
# Open browser console, test locally first with netlify dev
netlify dev
# Then try to add money → should open Razorpay checkout
```

### Step 3: Verify Supabase function (optional fall back)
```bash
# Test via curl or Supabase Dashboard function runner
```

### Step 4: Check console for errors
```bash
npm run dev
# Open http://localhost:5173
# Open DevTools → Console
# Log in and try to add money
# Should NOT see:
#  - "Could not find the table 'public.profiles'"
#  - CORS errors for create-razorpay-order
#  - 404 errors for profiles query
```

---

## If Still Getting Errors

### Check 1: Is `RAZORPAY_KEY_SECRET` set?
```javascript
// In browser console on deployed site
fetch('/.netlify/functions/create-razorpay-order', {
  method: 'POST',
  body: JSON.stringify({ amount: 100, receipt: 'test' })
})
.then(r => r.json())
.then(console.log)
// Should NOT say "Missing RAZORPAY_KEY_SECRET"
```

### Check 2: Is `profiles` table really created?
In Supabase Dashboard:
- SQL Editor → Run `SELECT * FROM information_schema.tables WHERE table_name='profiles';`
- Should return 1 row

### Check 3: Are RLS policies blocking access?
Try running in Supabase SQL Editor:
```sql
-- Test as public user (anon)
SELECT wallet_balance FROM profiles WHERE id = 'any-id';
-- Should fail with RLS error or return 0 rows (expected)
```

---

## TLDR: The 3 Fixes

1. ✅ **Create `profiles` table:** Run SQL in Supabase dashboard (copy from supabase/schema.sql lines 235-295)
2. ✅ **Add Razorpay secrets to Netlify:** Settings → Build & deploy → Environment (add RAZORPAY_KEY_ID and KEY_SECRET)
3. ✅ **Redeploy:** Netlify will auto-deploy on next commit, or manually trigger deploy

**Then test:** `npm run dev` → try to buy coupon → Razorpay checkout should open cleanly
