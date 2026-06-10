# Razorpay Setup - Supabase Edge Functions Only

All payment processing now goes through Supabase Edge Functions. Netlify functions have been removed.

## Setup Steps

### 1. Deploy Supabase Edge Functions

```bash
cd d:\work\coupon

# Set your Razorpay credentials in Supabase
supabase secrets set RAZORPAY_KEY_ID=rzp_test_5pB86mUoQ9t0p1
supabase secrets set RAZORPAY_KEY_SECRET=your_razorpay_secret_key_here

# Deploy the functions
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
```

### 2. Verify Functions are Deployed

Go to [Supabase Dashboard](https://supabase.com/dashboard) → Edge Functions

You should see:
- ✅ `create-razorpay-order`
- ✅ `verify-razorpay-payment`

Both should have a green "deployed" status.

### 3. Test Locally

```bash
npm run dev
```

Then:
1. Open http://localhost:5173
2. Log in (or create test account)
3. Go to UserDashboard
4. Click "Add Money"
5. Enter amount → should open Razorpay checkout modal
6. Check browser console for no errors

## Frontend .env File

Your `.env` only needs Supabase keys now:

```
VITE_SUPABASE_URL=https://ghoiannrniscrxedyzws.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_RAZORPAY_KEY_ID=rzp_test_5pB86mUoQ9t0p1
```

**Note:** `RAZORPAY_KEY_ID` above is used only in UserDashboard.tsx to validate the response. The actual `RAZORPAY_KEY_SECRET` is ONLY stored in Supabase and never exposed to the client.

## Architecture

### Before (Removed)
```
Browser → Netlify Function → Razorpay API
Browser → Netlify Function (verify) → Razorpay Check
```

### After (Current)
```
Browser → Supabase Edge Function → Razorpay API
Browser → Supabase Edge Function (verify) → Razorpay Check
```

**Advantage:** All payment processing is now in one place (Supabase), simpler deployment.

## Files Changed

✅ Removed:
- `netlify/functions/create-razorpay-order.js`
- `netlify/functions/verify-razorpay-payment.js`

✅ Updated:
- `src/lib/supabase.ts` - removed Netlify fallback logic
- `netlify.toml` - removed functions directory config
- `.env.example` - simplified

✅ Kept:
- `supabase/functions/create-razorpay-order/index.ts`
- `supabase/functions/verify-razorpay-payment/index.ts`

## Troubleshooting

### Error: "Missing RAZORPAY_KEY_SECRET"
- Go to Supabase Dashboard → Edge Functions → `create-razorpay-order` → Settings
- Verify environment variables are set
- Re-deploy: `supabase functions deploy create-razorpay-order`

### Error: CORS blocked
- The functions already have CORS headers, but clear browser cache
- Try in incognito mode
- Check Supabase function logs: Dashboard → Edge Functions → Logs tab

### Error: 404 for function
- Function might not be deployed
- Run: `supabase functions deploy`
- Or manually deploy from Supabase dashboard
