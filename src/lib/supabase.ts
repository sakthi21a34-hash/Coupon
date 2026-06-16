// src/lib/supabase.ts
import { createClient, FunctionsHttpError } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "https://placeholder.supabase.co";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "placeholder-anon-key";

export const isSupabaseConfigured =
  !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  console.warn(
    "[CouponVault] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set.\n" +
    "Copy .env.example to .env and add your Supabase credentials."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  global: { headers: {} },
  db: { schema: 'public' },
});

/**
 * Race a promise against a timeout so it never hangs forever.
 * Rejects with a TimeoutError after `ms` milliseconds.
 */
class TimeoutError extends Error {
  constructor(ms: number) { super(`Request timed out after ${ms}ms`); this.name = 'TimeoutError'; }
}
function withTimeout<T>(promise: PromiseLike<T>, ms = 8000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new TimeoutError(ms)), ms)),
  ]);
}

// ---- Interfaces --------------------------------------------------

export interface Company {
  id: string;
  name: string;
  prefix: string;
  coupon_limit: number;
  created_at: string;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  gstin?: string;
  pan?: string;
  address?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  document_url?: string;
  owner_id?: string;
}

export interface GiftCard {
  id: string;
  company_id: string;
  company_name?: string;
  title: string;
  description: string;
  value: number;
  price: number;
  expiry_date: string;
  banner_image: string;
  terms: string;
  issue_limit?: number | null;
  created_at: string;
  issued_count?: number;
}

export interface Coupon {
  id: string;
  company_id: string;
  company_name?: string;
  gift_card_id?: string;
  code: string;
  is_used: boolean;
  issued_to: string | null;
  created_at: string;
  remaining_balance: number;
  expiry_date: string;
  status: 'active' | 'redeemed' | 'expired';
  redeemed_at?: string;
}

export interface RedemptionTransaction {
  id: string;
  coupon_id: string;
  coupon_code?: string;
  company_name?: string;
  amount: number;
  remaining_balance_after: number;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  company_id: string;
  coupon_id: string | null;
  gift_card_id?: string;
  status: "pending" | "paid" | "failed";
  amount: number;
  payment_details?: any;
  created_at: string;
  company?: { name: string; prefix: string };
  coupon?: { code: string; is_used: boolean; remaining_balance: number; status: string } | null;
}

export interface CouponValidation {
  company_name: string;
  coupon_code: string;
  is_used: boolean;
  issued_at: string;
  remaining_balance: number;
  expiry_date: string;
  status: string;
  coupon_id: string;
}

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  role: string;
}

export interface AdminPurchasedCoupon {
  coupon_id: string;
  coupon_code: string;
  company_name: string;
  is_used: boolean;
  purchased_at: string;
  user_id: string;
  user_email: string;
  redeemed_at?: string;
  remaining_balance: number;
  status: string;
  price?: number;
  value?: number;
}

export interface CompanyStats {
  company: Company;
  issued: number;
  remaining: number;
}

// ---- LocalStorage Fallback Database Mock -------------------------

function getLocal<T>(key: string, def: T): T {
  const v = localStorage.getItem(key);
  if (!v) return def;
  try { return JSON.parse(v); } catch { return def; }
}

function setLocal<T>(key: string, val: T): void {
  localStorage.setItem(key, JSON.stringify(val));
}

const INIT_COMPANIES: Company[] = [
  {
    id: "co_starbucks",
    name: "Starbucks Coffee",
    prefix: "SBU",
    coupon_limit: 500,
    created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    status: "approved",
    gstin: "27AAAAA1111A1Z1",
    pan: "AAAAA1111A",
    address: "2401 Utah Ave S, Seattle, WA 98134",
    bank_name: "Chase Bank",
    account_number: "1234567890",
    ifsc_code: "CHAS0123456",
    document_url: "cert_incorporation_starbucks.pdf"
  },
  {
    id: "co_amazon",
    name: "Amazon Commerce",
    prefix: "AMZ",
    coupon_limit: 1000,
    created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
    status: "approved",
    gstin: "27BBBBB2222B2Z2",
    pan: "BBBBB2222B",
    address: "410 Terry Ave N, Seattle, WA 98109",
    bank_name: "Wells Fargo",
    account_number: "0987654321",
    ifsc_code: "WFBI0001234",
    document_url: "cert_incorp_amazon.pdf"
  },
  {
    id: "co_nike",
    name: "Nike Athletics",
    prefix: "NKE",
    coupon_limit: 300,
    created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    status: "approved",
    gstin: "27CCCCC3333C3Z3",
    pan: "CCCCC3333C",
    address: "One Bowerman Dr, Beaverton, OR 97005",
    bank_name: "Citibank",
    account_number: "1122334455",
    ifsc_code: "CITI0000001",
    document_url: "nike_kyc.pdf"
  }
];

const INIT_GIFT_CARDS: GiftCard[] = [
  {
    id: "gc_sbu_25",
    company_id: "co_starbucks",
    title: "Starbucks Brew Card",
    description: "Get delicious, fresh-brewed coffee and merchandise. Valid at all participating Starbucks locations.",
    value: 25,
    price: 22.50,
    expiry_date: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    banner_image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500&auto=format&fit=crop&q=60",
    terms: "Not redeemable for cash. Cannot be combined with other coupons.",
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "gc_amz_100",
    company_id: "co_amazon",
    title: "Amazon Shopping Ticket",
    description: "Access millions of items on Amazon.com. Safe, secure, and fast checkouts.",
    value: 100,
    price: 92.00,
    expiry_date: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    banner_image: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=500&auto=format&fit=crop&q=60",
    terms: "Voucher cannot be reloaded. Standard Amazon.com terms apply.",
    created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "gc_nke_150",
    company_id: "co_nike",
    title: "Nike Just Do It Gift Card",
    description: "Save on the latest footwear, athletic apparel, and accessories. Valid at Nike.com and Nike stores.",
    value: 150,
    price: 135.00,
    expiry_date: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    banner_image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=60",
    terms: "Redeemable for Nike gear online and in-store. No fees or expiration date.",
    created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
  }
];

export function initializeLocalStorageDB() {
  if (!localStorage.getItem("cv_companies")) {
    setLocal("cv_companies", INIT_COMPANIES);
  }
  if (!localStorage.getItem("cv_gift_cards")) {
    setLocal("cv_gift_cards", INIT_GIFT_CARDS);
  }
  if (!localStorage.getItem("cv_coupons")) {
    setLocal("cv_coupons", []);
  }
  if (!localStorage.getItem("cv_redemptions")) {
    setLocal("cv_redemptions", []);
  }
  if (!localStorage.getItem("cv_orders")) {
    setLocal("cv_orders", []);
  }
}

// Ensure the local storage mock DB is primed
initializeLocalStorageDB();

// ---- Company / Onboarding API ------------------------------------

export async function getCompanies(): Promise<Company[]> {
  try {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch (err: any) {
    console.warn("[CouponVault] getCompanies failed, falling back to LocalStorage:", err.message);
    return getLocal<Company[]>("cv_companies", []);
  }
}

export async function getCompanyByOwner(ownerId: string): Promise<Company | null> {
  try {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (err: any) {
    console.warn("[CouponVault] getCompanyByOwner failed, falling back to LocalStorage:", err.message);
    const companies = getLocal<Company[]>("cv_companies", []);
    return companies.find(c => c.owner_id === ownerId) ?? null;
  }
}

export async function submitOnboarding(companyData: Partial<Company>): Promise<Company> {
  const insertPayload = {
    name: companyData.name,
    prefix: (companyData.prefix ?? "MCH").toUpperCase().replace(/[^A-Z]/g, '').padEnd(3, 'X').substring(0, 3),
    coupon_limit: companyData.coupon_limit ?? 100,
    status: "pending",
    gstin: companyData.gstin,
    pan: companyData.pan,
    address: companyData.address,
    bank_name: companyData.bank_name,
    account_number: companyData.account_number,
    ifsc_code: companyData.ifsc_code,
    document_url: companyData.document_url || "cert_incorporation.pdf",
    owner_id: companyData.owner_id,
  };

  try {
    let response;
    if (companyData.owner_id) {
      const existingCompany = await getCompanyByOwner(companyData.owner_id);
      if (existingCompany) {
        response = await supabase
          .from("companies")
          .update(insertPayload)
          .eq("id", existingCompany.id)
          .select()
          .single();
      }
    }

    if (!response) {
      response = await supabase
        .from("companies")
        .insert(insertPayload)
        .select()
        .single();
    }

    const { data, error } = response;
    if (error) throw error;
    return data;
  } catch (err: any) {
    console.error("[CouponVault] submitOnboarding failed on the live database:", err.message);
    throw new Error(err.message || "Database rejected the company profile. Check constraints or RLS policies.");
  }
}

export async function createCompany(
  name: string,
  prefix: string,
  couponLimit: number
): Promise<Company> {
  try {
    const { data, error } = await supabase
      .from("companies")
      .insert({ name, prefix: prefix.toUpperCase(), coupon_limit: couponLimit, status: 'approved' })
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err: any) {
    console.warn("[CouponVault] createCompany failed, falling back to LocalStorage:", err.message);
    const companies = getLocal<Company[]>("cv_companies", []);
    const newCompany: Company = {
      id: "co_" + Math.random().toString(36).substr(2, 9),
      name,
      prefix: prefix.toUpperCase(),
      coupon_limit: couponLimit,
      status: 'approved',
      created_at: new Date().toISOString()
    };
    companies.push(newCompany);
    setLocal("cv_companies", companies);
    return newCompany;
  }
}

export async function deleteCompany(id: string): Promise<void> {
  try {
    const { error: ordersErr } = await supabase.from("orders").delete().eq("company_id", id);
    if (ordersErr) throw ordersErr;
    const { error: couponsErr } = await supabase.from("coupons").delete().eq("company_id", id);
    if (couponsErr) throw couponsErr;
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) throw error;
  } catch (err: any) {
    console.warn("[CouponVault] deleteCompany failed, falling back to LocalStorage:", err.message);
    let companies = getLocal<Company[]>("cv_companies", []);
    companies = companies.filter(c => c.id !== id);
    setLocal("cv_companies", companies);

    let cards = getLocal<GiftCard[]>("cv_gift_cards", []);
    cards = cards.filter(c => c.company_id !== id);
    setLocal("cv_gift_cards", cards);

    let coupons = getLocal<Coupon[]>("cv_coupons", []);
    coupons = coupons.filter(c => c.company_id !== id);
    setLocal("cv_coupons", coupons);
  }
}

export async function updateCompanyLimit(id: string, limit: number): Promise<Company> {
  try {
    const { data, error } = await supabase
      .from("companies")
      .update({ coupon_limit: limit })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err: any) {
    console.warn("[CouponVault] updateCompanyLimit failed, falling back to LocalStorage:", err.message);
    const companies = getLocal<Company[]>("cv_companies", []);
    const co = companies.find(c => c.id === id);
    if (!co) throw new Error("Company not found");
    co.coupon_limit = limit;
    setLocal("cv_companies", companies);
    return co;
  }
}

export async function adminApproveCompany(id: string): Promise<Company> {
  try {
    const { data, error } = await supabase
      .from("companies")
      .update({ status: "approved" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err: any) {
    console.warn("[CouponVault] adminApproveCompany failed, falling back to LocalStorage:", err.message);
    const companies = getLocal<Company[]>("cv_companies", []);
    const co = companies.find(c => c.id === id);
    if (!co) throw new Error("Company not found");
    co.status = "approved";
    setLocal("cv_companies", companies);
    return co;
  }
}

export async function adminRejectCompany(id: string): Promise<Company> {
  try {
    const { data, error } = await supabase
      .from("companies")
      .update({ status: "rejected" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err: any) {
    console.warn("[CouponVault] adminRejectCompany failed, falling back to LocalStorage:", err.message);
    const companies = getLocal<Company[]>("cv_companies", []);
    const co = companies.find(c => c.id === id);
    if (!co) throw new Error("Company not found");
    co.status = "rejected";
    setLocal("cv_companies", companies);
    return co;
  }
}

export async function getCompanyStats(): Promise<CompanyStats[]> {
  try {
    const { data: companies, error: ce } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });
    if (ce) throw ce;

    const { data: counts, error: cnte } = await supabase
      .from("coupons")
      .select("company_id");
    if (cnte) throw cnte;

    const issuedMap: Record<string, number> = {};
    (counts ?? []).forEach((c) => {
      issuedMap[c.company_id] = (issuedMap[c.company_id] ?? 0) + 1;
    });

    return (companies ?? []).map((co) => ({
      company: co,
      issued: issuedMap[co.id] ?? 0,
      remaining: co.coupon_limit - (issuedMap[co.id] ?? 0),
    }));
  } catch (err: any) {
    console.warn("[CouponVault] getCompanyStats failed, falling back to LocalStorage:", err.message);
    const companies = getLocal<Company[]>("cv_companies", []);
    const coupons = getLocal<Coupon[]>("cv_coupons", []);
    return companies.map(co => {
      const issued = coupons.filter(c => c.company_id === co.id).length;
      return {
        company: co,
        issued,
        remaining: co.coupon_limit - issued
      };
    });
  }
}

// ---- Gift Card API -----------------------------------------------

export async function getGiftCards(companyId?: string): Promise<GiftCard[]> {
  try {
    let query = supabase.from("gift_cards").select("*, companies(name)");
    if (companyId) {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await withTimeout(query.order("created_at", { ascending: false }), 8000);
    if (error) throw error;
    const localCards = getLocal<GiftCard[]>("cv_gift_cards", []);
    const localFiltered = companyId ? localCards.filter(c => c.company_id === companyId) : localCards;
    
    return [
      ...localFiltered,
      ...(data ?? []).map((d: any) => ({
        ...d,
        company_name: d.companies?.name,
        issued_count: 0
      }))
    ];
  } catch (err: any) {
    console.warn("[CouponVault] getGiftCards failed, falling back to LocalStorage:", err.message);
    const cards = getLocal<GiftCard[]>("cv_gift_cards", []);
    const companies = getLocal<Company[]>("cv_companies", []);
    const filtered = companyId ? cards.filter(c => c.company_id === companyId) : cards;
    return filtered.map(c => {
      const co = companies.find(comp => comp.id === c.company_id);
      return { ...c, company_name: co ? co.name : "Unknown Brand" };
    });
  }
}

export async function createGiftCard(giftCardData: Omit<GiftCard, 'id' | 'created_at'>): Promise<GiftCard> {
  try {
    const { data, error } = await supabase
      .from("gift_cards")
      .insert(giftCardData)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err: any) {
    console.warn("[CouponVault] createGiftCard failed, falling back to LocalStorage:", err.message);
    const cards = getLocal<GiftCard[]>("cv_gift_cards", []);
    const newCard: GiftCard = {
      id: "gc_" + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
      ...giftCardData
    };
    cards.push(newCard);
    setLocal("cv_gift_cards", cards);
    return newCard;
  }
}

export async function deleteGiftCard(id: string): Promise<void> {
  const { data, error } = await supabase.from("gift_cards").delete().eq("id", id).select("id");
  
  if (error) {
    console.error("[CouponVault] deleteGiftCard failed:", error);
    if (error.code === '23503') { // foreign_key_violation
      throw new Error("Cannot delete this campaign because customers have already purchased vouchers from it.");
    }
    throw new Error(error.message);
  }
  
  if (!data || data.length === 0) {
    throw new Error("Deletion blocked by database security policy. The campaign either doesn't exist or you don't have permission.");
  }
}

// ---- Coupon Purchase Flow (RPC issue_gift_card_coupon equivalent) ----

export async function purchaseGiftCard(
  giftCardId: string,
  userId: string,
  _userEmail: string,
  amountPaid: number
): Promise<{ coupon_code: string; order_id: string; coupon_id: string }> {
  try {
    const { data, error } = await supabase.rpc("issue_gift_card_coupon", {
      p_gift_card_id: giftCardId,
      p_user_id: userId,
      p_amount: amountPaid
    });
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Failed to issue coupon");
    return {
      coupon_code: data[0].coupon_code,
      order_id: data[0].order_id,
      coupon_id: data[0].coupon_id
    };
  } catch (err: any) {
    console.warn("[CouponVault] purchaseGiftCard failed, falling back to LocalStorage:", err.message);
    const cards = getLocal<GiftCard[]>("cv_gift_cards", []);
    const gc = cards.find(c => c.id === giftCardId);
    if (!gc) throw new Error("Gift card template not found");

    const companies = getLocal<Company[]>("cv_companies", []);
    const co = companies.find(c => c.id === gc.company_id);
    const prefix = co ? co.prefix : "MCH";

    // Generate code
    const randomHex = Math.random().toString(36).substr(2, 8).toUpperCase();
    const code = `${prefix}-${randomHex}`;

    const couponId = "cp_" + Math.random().toString(36).substr(2, 9);
    const orderId = "or_" + Math.random().toString(36).substr(2, 9);

    const newCoupon: Coupon = {
      id: couponId,
      company_id: gc.company_id,
      gift_card_id: giftCardId,
      code,
      is_used: false,
      issued_to: userId,
      remaining_balance: gc.value,
      expiry_date: gc.expiry_date || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      status: "active",
      created_at: new Date().toISOString()
    };

    const newOrder: Order = {
      id: orderId,
      user_id: userId,
      company_id: gc.company_id,
      coupon_id: couponId,
      gift_card_id: giftCardId,
      status: "paid",
      amount: amountPaid,
      payment_details: { payment_id: "pay_" + Math.random().toString(36).substr(2, 9), gateway: "stripe_mock" },
      created_at: new Date().toISOString()
    };

    const coupons = getLocal<Coupon[]>("cv_coupons", []);
    const orders = getLocal<Order[]>("cv_orders", []);

    coupons.push(newCoupon);
    orders.push(newOrder);

    setLocal("cv_coupons", coupons);
    setLocal("cv_orders", orders);

    return {
      coupon_code: code,
      order_id: orderId,
      coupon_id: couponId
    };
  }
}

export async function getUserOrders(userId: string) {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("orders")
        .select(`
          *,
          company:companies(name, prefix),
          coupon:coupons(code, is_used, remaining_balance, status)
        `)
        .eq("user_id", userId)
        .eq("status", "paid")
        .order("created_at", { ascending: false }),
      8000
    );
    if (error) throw error;
    return data ?? [];
  } catch (err: any) {
    console.warn("[CouponVault] getUserOrders failed, falling back to LocalStorage:", err.message);
    const orders = getLocal<Order[]>("cv_orders", []);
    const companies = getLocal<Company[]>("cv_companies", []);
    const coupons = getLocal<Coupon[]>("cv_coupons", []);
    const userOrders = orders.filter(o => o.user_id === userId && o.status === "paid");
    
    return userOrders.map(o => {
      const co = companies.find(comp => comp.id === o.company_id);
      const cp = coupons.find(coup => coup.id === o.coupon_id);
      return {
        ...o,
        company: co ? { name: co.name, prefix: co.prefix } : { name: "Unknown", prefix: "MCH" },
        coupon: cp ? { code: cp.code, is_used: cp.is_used, remaining_balance: cp.remaining_balance, status: cp.status } : null
      };
    });
  }
}

export async function getUserGiftCards(userId: string): Promise<Coupon[]> {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("coupons")
        .select("*, companies(name)")
        .eq("issued_to", userId)
        .order("created_at", { ascending: false }),
      8000
    );
    if (error) throw error;
    return (data ?? []).map(d => ({
      ...d,
      company_name: d.companies?.name
    }));
  } catch (err: any) {
    console.warn("[CouponVault] getUserGiftCards failed, falling back to LocalStorage:", err.message);
    const coupons = getLocal<Coupon[]>("cv_coupons", []);
    const companies = getLocal<Company[]>("cv_companies", []);
    const userCoupons = coupons.filter(c => c.issued_to === userId);
    return userCoupons.map(c => {
      const co = companies.find(comp => comp.id === c.company_id);
      return {
        ...c,
        company_name: co ? co.name : "Unknown Brand"
      };
    });
  }
}

export async function getCompanyCoupons(companyId: string): Promise<Coupon[]> {
  try {
    const { data, error } = await supabase
      .from("coupons")
      .select("*, companies(name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(d => ({
      ...d,
      company_name: d.companies?.name
    }));
  } catch (err: any) {
    console.warn("[CouponVault] getCompanyCoupons failed, falling back to LocalStorage:", err.message);
    const coupons = getLocal<Coupon[]>("cv_coupons", []);
    const companies = getLocal<Company[]>("cv_companies", []);
    const companyCoupons = coupons.filter(c => c.company_id === companyId);
    return companyCoupons.map(c => {
      const co = companies.find(comp => comp.id === c.company_id);
      return {
        ...c,
        company_name: co ? co.name : "Unknown Brand"
      };
    });
  }
}

// ---- Scanner / Validation / Redemption API -----------------------

export async function validateCoupon(code: string): Promise<CouponValidation> {
  try {
    const { data, error } = await supabase.rpc("validate_coupon", {
      p_code: code.toUpperCase().trim(),
    });
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Invalid coupon code");
    return data[0] as CouponValidation;
  } catch (err: any) {
    console.warn("[CouponVault] validateCoupon failed, falling back to LocalStorage:", err.message);
    const coupons = getLocal<Coupon[]>("cv_coupons", []);
    const companies = getLocal<Company[]>("cv_companies", []);
    const cp = coupons.find(c => c.code.toUpperCase().trim() === code.toUpperCase().trim());
    if (!cp) throw new Error("Invalid coupon code");
    
    const co = companies.find(comp => comp.id === cp.company_id);
    return {
      coupon_id: cp.id,
      coupon_code: cp.code,
      company_name: co ? co.name : "Unknown Brand",
      is_used: cp.is_used,
      issued_at: cp.created_at,
      remaining_balance: cp.remaining_balance,
      expiry_date: cp.expiry_date,
      status: cp.status
    };
  }
}

export async function validateCouponById(id: string): Promise<CouponValidation> {
  try {
    const { data, error } = await supabase.rpc("validate_coupon_by_id", {
      p_coupon_id: id,
    });
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Invalid coupon link");
    return data[0] as CouponValidation;
  } catch (err: any) {
    console.warn("[CouponVault] validateCouponById failed, falling back to LocalStorage:", err.message);
    const coupons = getLocal<Coupon[]>("cv_coupons", []);
    const companies = getLocal<Company[]>("cv_companies", []);
    const cp = coupons.find(c => c.id === id);
    if (!cp) throw new Error("Invalid coupon link");
    
    const co = companies.find(comp => comp.id === cp.company_id);
    return {
      coupon_id: cp.id,
      coupon_code: cp.code,
      company_name: co ? co.name : "Unknown Brand",
      is_used: cp.is_used,
      issued_at: cp.created_at,
      remaining_balance: cp.remaining_balance,
      expiry_date: cp.expiry_date,
      status: cp.status
    };
  }
}

export async function redeemCouponAmount(couponId: string, amount: number): Promise<{ remaining_balance: number; status: string }> {
  try {
    const { data, error } = await supabase.rpc("redeem_coupon_amount", {
      p_coupon_id: couponId,
      p_amount: amount
    });
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Redemption failed");
    return {
      remaining_balance: data[0].remaining_balance,
      status: data[0].status
    };
  } catch (err: any) {
    console.warn("[CouponVault] redeemCouponAmount failed, falling back to LocalStorage:", err.message);
    const coupons = getLocal<Coupon[]>("cv_coupons", []);
    const redemptions = getLocal<RedemptionTransaction[]>("cv_redemptions", []);
    
    const cp = coupons.find(c => c.id === couponId);
    if (!cp) throw new Error("Coupon not found");
    if (cp.status === "redeemed" || cp.is_used) throw new Error("Coupon is already fully redeemed");
    if (new Date(cp.expiry_date) < new Date()) throw new Error("Coupon has expired");
    if (cp.remaining_balance < amount) throw new Error(`Insufficient coupon balance. Available balance: ₹${cp.remaining_balance}`);

    cp.remaining_balance -= amount;
    if (cp.remaining_balance === 0) {
      cp.status = "redeemed";
      cp.is_used = true;
      cp.redeemed_at = new Date().toISOString();
    }

    const newRedemption: RedemptionTransaction = {
      id: "rd_" + Math.random().toString(36).substr(2, 9),
      coupon_id: couponId,
      amount,
      remaining_balance_after: cp.remaining_balance,
      created_at: new Date().toISOString()
    };

    redemptions.push(newRedemption);
    
    setLocal("cv_coupons", coupons);
    setLocal("cv_redemptions", redemptions);

    return {
      remaining_balance: cp.remaining_balance,
      status: cp.status
    };
  }
}

export async function markCouponUsedById(id: string): Promise<string> {
  try {
    const { data: cp, error } = await supabase
      .from("coupons")
      .update({ is_used: true, status: "redeemed", remaining_balance: 0 })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return cp.code;
  } catch (err: any) {
    console.warn("[CouponVault] markCouponUsedById failed, falling back to LocalStorage:", err.message);
    const coupons = getLocal<Coupon[]>("cv_coupons", []);
    const cp = coupons.find(c => c.id === id);
    if (!cp) throw new Error("Coupon not found");
    cp.is_used = true;
    cp.status = "redeemed";
    cp.remaining_balance = 0;
    setLocal("cv_coupons", coupons);
    return cp.code;
  }
}

export async function getRedemptionTransactions(couponId?: string, companyId?: string): Promise<RedemptionTransaction[]> {
  try {
    // Attempt standard read
    const query = supabase.from("redemptions").select("*, coupons(code, companies(name))");
    const { data, error } = await withTimeout(query.order("created_at", { ascending: false }), 8000);
    if (error) throw error;
    
    let list = (data ?? []).map(d => ({
      id: d.id,
      coupon_id: d.coupon_id,
      coupon_code: d.coupons?.code,
      company_name: d.coupons?.companies?.name,
      amount: d.amount,
      remaining_balance_after: d.remaining_balance_after,
      created_at: d.created_at
    }));

    if (couponId) list = list.filter(l => l.coupon_id === couponId);
    return list;
  } catch (err: any) {
    console.warn("[CouponVault] getRedemptionTransactions failed, falling back to LocalStorage:", err.message);
    const redemptions = getLocal<RedemptionTransaction[]>("cv_redemptions", []);
    const coupons = getLocal<Coupon[]>("cv_coupons", []);
    const companies = getLocal<Company[]>("cv_companies", []);
    
    let list = redemptions.map(r => {
      const cp = coupons.find(c => c.id === r.coupon_id);
      const co = cp ? companies.find(comp => comp.id === cp.company_id) : null;
      return {
        ...r,
        coupon_code: cp ? cp.code : "UNKNOWN",
        company_name: co ? co.name : "Unknown Brand"
      };
    });

    if (couponId) {
      list = list.filter(r => r.coupon_id === couponId);
    }
    if (companyId) {
      const companyCoupons = coupons.filter(c => c.company_id === companyId).map(c => c.id);
      list = list.filter(r => companyCoupons.includes(r.coupon_id));
    }

    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

// Deprecated old coupon methods kept for compatibility with existing tests/shims
export async function markCouponUsed(code: string): Promise<void> {
  const validation = await validateCoupon(code);
  await redeemCouponAmount(validation.coupon_id, validation.remaining_balance);
}

export async function issueCoupon(
  companyId: string,
  userId: string
): Promise<{ coupon_code: string; order_id: string; coupon_id: string }> {
  // Legacy method fallback: Create a default ₹50 gift card for that company if it exists
  try {
    const { data: giftCards, error } = await supabase
      .from("gift_cards")
      .select("id")
      .eq("company_id", companyId)
      .limit(1);
    if (!error && giftCards && giftCards.length > 0) {
      return purchaseGiftCard(giftCards[0].id, userId, "legacy_user@couponvault.com", 50);
    }
  } catch {
    // Ignore and fallback
  }
  
  // Fallback storage fallback
  const cards = getLocal<GiftCard[]>("cv_gift_cards", []);
  let gc = cards.find(c => c.company_id === companyId);
  if (!gc) {
    gc = {
      id: "gc_temp_" + companyId,
      company_id: companyId,
      title: "Promotional Gift Card",
      description: "Default voucher",
      value: 50,
      price: 45,
      expiry_date: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      banner_image: "",
      terms: "Legacy support",
      created_at: new Date().toISOString()
    };
    cards.push(gc);
    setLocal("cv_gift_cards", cards);
  }
  return purchaseGiftCard(gc.id, userId, "legacy_user@couponvault.com", 50);
}

// ---- Admin Management helpers ------------------------------------

export async function adminGetUsers(page: number = 0, pageSize: number = 20): Promise<AdminUser[]> {
  try {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase.rpc("admin_get_users").range(from, to);
    if (error) throw error;
    return data ?? [];
  } catch (err: any) {
    console.warn("[CouponVault] adminGetUsers failed, returning mock list:", err.message);
    return [
      { id: "usr_101", email: "customer@demo.com", created_at: new Date().toISOString(), role: "customer" },
      { id: "usr_102", email: "merchant@starbucks.com", created_at: new Date().toISOString(), role: "merchant" },
      { id: "usr_103", email: "admin@couponvault.com", created_at: new Date().toISOString(), role: "admin" }
    ];
  }
}

export async function adminGetPurchasedCoupons(page: number = 0, pageSize: number = 20): Promise<AdminPurchasedCoupon[]> {
  try {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase.rpc("admin_get_purchased_coupons").range(from, to);
    if (error) throw error;
    return data ?? [];
  } catch (err: any) {
    console.warn("[CouponVault] adminGetPurchasedCoupons failed, falling back to LocalStorage:", err.message);
    const coupons = getLocal<Coupon[]>("cv_coupons", []);
    const companies = getLocal<Company[]>("cv_companies", []);
    const giftCards = getLocal<GiftCard[]>("cv_gift_cards", []);
    return coupons.map(c => {
      const co = companies.find(comp => comp.id === c.company_id);
      const gc = giftCards.find(card => card.id === c.gift_card_id);
      return {
        coupon_id: c.id,
        coupon_code: c.code,
        company_name: co ? co.name : "Unknown Brand",
        is_used: c.is_used,
        purchased_at: c.created_at,
        user_id: c.issued_to || "anonymous",
        user_email: c.issued_to === "usr_101" ? "customer@demo.com" : "customer@demo.com",
        redeemed_at: c.redeemed_at,
        remaining_balance: c.remaining_balance,
        status: c.status,
        price: gc ? gc.price : c.remaining_balance * 0.9,
        value: gc ? gc.value : c.remaining_balance
      };
    });
  }
}

export async function adminSuspendCompany(companyId: string): Promise<Company> {
  try {
    const { data, error } = await supabase
      .from("companies")
      .update({ status: "suspended" })
      .eq("id", companyId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err: any) {
    console.warn("[CouponVault] adminSuspendCompany failed, falling back to LocalStorage:", err.message);
    const companies = getLocal<Company[]>("cv_companies", []);
    const co = companies.find(c => c.id === companyId);
    if (!co) throw new Error("Company not found");
    co.status = "suspended";
    setLocal("cv_companies", companies);
    return co;
  }
}

export async function getUserWalletBalance(userId: string): Promise<number> {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("profiles")
        .select("wallet_balance")
        .eq("id", userId)
        .maybeSingle(),
      6000
    );
      
    if (error) throw error;
    if (data) {
      return data.wallet_balance;
    }
    
    // If no profile exists, create one with 0 balance
    const { data: newProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({ id: userId, wallet_balance: 0 })
      .select("wallet_balance")
      .single();
      
    if (insertError) throw insertError;
    return newProfile?.wallet_balance ?? 0;
  } catch (err: any) {
    if (!isMissingProfilesTableError(err)) {
      console.warn("[CouponVault] getUserWalletBalance failed, falling back to LocalStorage:", err.message);
    }
    const balance = localStorage.getItem(`cv-user-balance-${userId}`);
    return balance ? parseFloat(balance) : 0;
  }
}

// DEPRECATED: Do not use for financial transactions on the frontend
export async function updateBalances(newBalance: number): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) {
    await supabase.from("profiles").update({ wallet_balance: newBalance }).eq("id", session.user.id);
  }
}

// 10X SECURE: Use this for adding funds to prevent client-side manipulation
export async function addFunds(userId: string, amount: number): Promise<number> {
  const { data, error } = await supabase.rpc("add_wallet_funds", {
    p_user_id: userId,
    p_amount: amount
  });
  if (error) throw error;
  return data;
}

export async function updateUserWalletBalance(userId: string, amount: number): Promise<void> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ wallet_balance: amount })
      .eq("id", userId);
      
    if (error) throw error;
  } catch (err: any) {
    if (!isMissingProfilesTableError(err)) {
      console.warn("[CouponVault] updateUserWalletBalance failed, falling back to LocalStorage:", err.message);
    }
  } finally {
    localStorage.setItem(`cv-user-balance-${userId}`, String(amount));
  }
}

export async function ensureUserProfile(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    if (data) return;

    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: userId, wallet_balance: 0 });

    if (insertError) throw insertError;
  } catch (err: any) {
    if (!isMissingProfilesTableError(err)) {
      console.warn("[CouponVault] ensureUserProfile failed:", err.message);
    }
  }
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  key_id: string;
}

function isMissingProfilesTableError(error: unknown) {
  return error instanceof Error && error.message.includes("Could not find the table 'public.profiles'");
}

function isValidRazorpayKeyId(value: string | undefined) {
  return typeof value === "string" && /^rzp_(test|live)_[A-Za-z0-9]+$/.test(value);
}

function isLocalDevHost() {
  return typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

async function readFunctionsInvokeErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    try {
      const clone = res.clone();
      const ct = clone.headers.get("Content-Type") ?? "";
      if (ct.includes("application/json")) {
        const json = (await clone.json()) as { error?: string; message?: string };
        if (json?.error) return json.error;
        if (json?.message) return json.message;
      } else {
        const text = await clone.text();
        if (text) return text.slice(0, 500);
      }
    } catch {
      /* ignore */
    }
    return `${error.message} (HTTP ${(error.context as Response)?.status ?? "?"})`;
  }
  return error instanceof Error ? error.message : String(error);
}

export async function createRazorpayOrder(input: {
  amount: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (isLocalDevHost()) {
    const fallbackKey = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
    if (isValidRazorpayKeyId(fallbackKey)) {
      return {
        id: "",
        amount: input.amount,
        currency: input.currency ?? "INR",
        receipt: input.receipt,
        status: "created",
        key_id: fallbackKey!,
      };
    }
    throw new Error("Missing valid VITE_RAZORPAY_KEY_ID for local checkout.");
  }

  const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
    body: {
      amount: input.amount,
      currency: input.currency ?? "INR",
      receipt: input.receipt,
      notes: input.notes ?? {},
    },
  });

  if (!error && data?.id) {
    return data as RazorpayOrder;
  }

  if (error) {
    throw new Error(await readFunctionsInvokeErrorMessage(error));
  }

  throw new Error("Razorpay order response was incomplete.");
}

export async function verifyRazorpayPayment(input: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ verified: boolean }> {
  if (isLocalDevHost()) {
    return { verified: true };
  }

  const { data, error } = await supabase.functions.invoke("verify-razorpay-payment", {
    body: input,
  });

  if (!error && data?.verified) {
    return data as { verified: boolean };
  }

  if (error) {
    throw new Error(await readFunctionsInvokeErrorMessage(error));
  }

  if (!data?.verified) {
    throw new Error("Razorpay payment verification failed.");
  }

  return data as { verified: boolean };
}
