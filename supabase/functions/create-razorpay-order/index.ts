import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

// Accept rzp_test_*, rzp_live_*, and re_* (route/batch settlement keys)
function isValidRazorpayKeyId(value: string) {
  return /^(rzp_(test|live)_|re_)[A-Za-z0-9_]+$/.test(value);
}

serve(async (req: Request) => {
  // Always respond OK to CORS preflight - must be first
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

    if (!razorpayKeyId || !razorpayKeySecret) {
      return jsonResponse(
        {
          error:
            "Missing Razorpay server credentials. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Supabase Edge Function secrets.",
        },
        500,
      );
    }

    if (!isValidRazorpayKeyId(razorpayKeyId)) {
      return jsonResponse(
        {
          error: `RAZORPAY_KEY_ID format is invalid. Must start with rzp_test_, rzp_live_, or re_.`,
        },
        500,
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400);
    }

    const { amount, currency = "INR", receipt, notes = {} } = body as {
      amount: unknown;
      currency?: string;
      receipt: unknown;
      notes?: Record<string, string>;
    };

    const amountNum = typeof amount === "number" ? amount : Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return jsonResponse({ error: "Amount must be a positive number." }, 400);
    }

    if (!receipt || typeof receipt !== "string") {
      return jsonResponse({ error: "Receipt is required." }, 400);
    }

    const authHeader = `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`;
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(amountNum),
        currency,
        receipt,
        notes,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      return jsonResponse(
        {
          error: payload?.error?.description || payload?.error?.reason || "Failed to create Razorpay order.",
          razorpay: payload,
        },
        response.status,
      );
    }

    return jsonResponse(
      {
        ...payload,
        key_id: razorpayKeyId,
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
