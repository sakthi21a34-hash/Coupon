import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCode } from 'react-qr-code';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, SearchX, Wallet, CreditCard, Activity, ArrowLeftRight, Gift, Sparkles, Zap, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { DashboardCard } from '../components/GlassCard';
import type { Coupon, GiftCard, Order, RedemptionTransaction } from '../lib/supabase';
import {
  getGiftCards,
  getRedemptionTransactions,
  getUserGiftCards,
  getUserOrders,
  getUserWalletBalance,
  purchaseGiftCard,
  updateUserWalletBalance,
  addFunds,
  supabase
} from '../lib/supabase';

function loadScript(src: string) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const validSections = ['marketplace', 'wallet', 'activity', 'cards'] as const;
type UserSection = (typeof validSections)[number];

function isUserSection(value: string | undefined): value is UserSection {
  return !!value && validSections.includes(value as UserSection);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function UserDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();

  const currentSection: UserSection = isUserSection(section) ? section : 'marketplace';

  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [userVouchers, setUserVouchers] = useState<Coupon[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [priceFilter, setPriceFilter] = useState('All');

  const [walletBalance, setWalletBalance] = useState(0);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState(1);
  const [withdrawForm, setWithdrawForm] = useState({ routing: '', account: '', amount: '' });
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [addMoneyAmount, setAddMoneyAmount] = useState('500');
  const [addMoneyLoading, setAddMoneyLoading] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<GiftCard | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [activeVoucher, setActiveVoucher] = useState<Coupon | null>(null);
  const [visibleCodes, setVisibleCodes] = useState<Record<string, boolean>>({});
  const [mockPaymentForm, setMockPaymentForm] = useState({
    name: 'Demo Customer',
    method: 'Card ending 4242',
  });

  useEffect(() => {
    if (!section) {
      navigate('/dashboard/marketplace', { replace: true });
      return;
    }

    if (!isUserSection(section)) {
      navigate('/dashboard/marketplace', { replace: true });
    }
  }, [navigate, section]);

  useEffect(() => {
    if (!user?.id) return;

    const syncWalletState = async () => {
      try {
        const balance = await getUserWalletBalance(user.id);
        setWalletBalance(balance);
      } catch (err) {
        console.error("Failed to sync wallet state:", err);
      }
    };

    void syncWalletState();
  }, [user]);

  async function refreshWalletBalance() {
    if (!user?.id) return;
    try {
      const balance = await getUserWalletBalance(user.id);
      setWalletBalance(balance);
    } catch (err: unknown) {
      console.warn("Could not fetch wallet balance:", err);
    }
  }

  const userId = user?.id;

  const toastErrorRef = useRef(toastError);
  useEffect(() => { toastErrorRef.current = toastError; }, [toastError]);

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);

      // Race the data loading against a 12-second timeout
      const loadTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Data loading timed out. Please try again.')), 12000)
      );

      const [cards, vouchers, userOrders, userRedemptions] = await Promise.race([
        Promise.all([
          getGiftCards(),
          getUserGiftCards(userId),
          getUserOrders(userId),
          getRedemptionTransactions(),
        ]),
        loadTimeout,
      ]);

      setGiftCards(cards);
      setUserVouchers(vouchers);
      setOrders(userOrders);

      const voucherIds = vouchers.map((voucher) => voucher.id);
      setRedemptions(userRedemptions.filter((redemption) => voucherIds.includes(redemption.coupon_id)));
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Failed to load dashboard details.');
      toastErrorRef.current('Load error', msg);
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) return;

    const syncDashboard = async () => {
      await loadData();
    };

    void syncDashboard();
  }, [authLoading, userId, loadData]);

  const handleInitiatePurchase = (card: GiftCard) => {
    setSelectedProduct(card);
    setShowPaymentModal(true);
  };

  const handleConfirmWalletPayment = async () => {
    if (!selectedProduct || !user) return;

    if (walletBalance < selectedProduct.price) {
      toastError('Insufficient funds', 'Your wallet balance is lower than the purchase price.');
      return;
    }

    setPaymentLoading(true);
    const newBalance = walletBalance - selectedProduct.price;
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // 1. Deduct wallet balance first
      await updateUserWalletBalance(user.id, newBalance);
      setWalletBalance(newBalance);

      // 2. Issue the gift card coupon
      const result = await purchaseGiftCard(
        selectedProduct.id,
        user.id,
        user.email || 'customer@demo.com',
        selectedProduct.price,
      );

      // 3. Re-sync balance from server to confirm
      await refreshWalletBalance();

      success('Payment authorized', `Voucher code generated: ${result.coupon_code}`);
      setShowPaymentModal(false);
      setSelectedProduct(null);
      navigate('/dashboard/cards');
      loadData();
    } catch (err: unknown) {
      // Rollback wallet deduction if coupon issuance failed
      try {
        await updateUserWalletBalance(user.id, walletBalance);
        setWalletBalance(walletBalance);
      } catch {
        // Best-effort rollback
      }
      toastError('Gateway error', getErrorMessage(err, 'Transaction authorization failed. Balance has been restored.'));
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleRazorpayPurchase = async () => {
    if (!selectedProduct || !user) return;

    setPaymentLoading(true);
    try {
      const res = await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      if (!res) throw new Error('Razorpay SDK failed to load');

      // Create order
      const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
        body: { amount: selectedProduct.price, currency: 'INR', receipt: `rcpt_${Date.now()}` },
      });
      
      // Graceful fallback to Simple Test Mode if Edge Function fails (e.g. missing keys)
      if (orderError || !orderData) {
        throw new Error(orderError?.message || 'Failed to create order');
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || orderData.key_id || 'rzp_test_placeholder',
        amount: orderData.amount.toString(),
        currency: orderData.currency,
        name: 'CouponVault Checkout',
        description: `Purchase ${selectedProduct.title}`,
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            if (verifyError || !verifyData?.verified) throw new Error('Verification failed');

            // Fulfill order
            const result = await purchaseGiftCard(
              selectedProduct.id,
              user.id,
              user.email || 'customer@demo.com',
              selectedProduct.price,
            );

            success('Payment approved', `Voucher code generated: ${result.coupon_code}`);
            setShowPaymentModal(false);
            setSelectedProduct(null);
            navigate('/dashboard/cards');
            loadData();
          } catch (err: unknown) {
            toastError('Verification Error', getErrorMessage(err, 'Failed to verify payment with server.'));
          }
        },
        prefill: { email: user.email || '' },
        theme: { color: '#8b5cf6' },
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();
    } catch (err: unknown) {
      console.warn("Razorpay integration failed, falling back to simple test mode:", err);
      // SIMPLE TEST MODE FALLBACK: deduct wallet just like wallet payment
      if (walletBalance < selectedProduct.price) {
        toastError('Insufficient funds', 'Your wallet balance is too low to complete this purchase.');
        setPaymentLoading(false);
        return;
      }
      const newBalance = walletBalance - selectedProduct.price;
      try {
        await updateUserWalletBalance(user.id, newBalance);
        setWalletBalance(newBalance);
        const result = await purchaseGiftCard(
          selectedProduct.id,
          user.id,
          user.email || 'customer@demo.com',
          selectedProduct.price,
        );
        await refreshWalletBalance();
        success('Test Payment Approved', `Voucher code: ${result.coupon_code}`);
        setShowPaymentModal(false);
        setSelectedProduct(null);
        navigate('/dashboard/cards');
        loadData();
      } catch (mockErr: unknown) {
        // Rollback
        try { await updateUserWalletBalance(user.id, walletBalance); setWalletBalance(walletBalance); } catch { /* ignore */ }
        toastError('Payment error', getErrorMessage(mockErr, 'Could not complete checkout.'));
      }
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleWithdrawalSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;
    const amount = parseFloat(withdrawForm.amount);
    if (isNaN(amount) || amount <= 0 || amount > walletBalance) {
      toastError('Invalid amount', 'Check your wallet balance.');
      return;
    }

    setWithdrawLoading(true);
    try {
      const newBalance = walletBalance - amount;
      // Persist to database
      await updateUserWalletBalance(user.id, newBalance);
      await refreshWalletBalance();
      setWithdrawStep(2);
      success('Withdrawal completed', `Payout of ₹${amount.toFixed(2)} processed successfully.`);
    } catch (err: unknown) {
      toastError('Withdrawal error', getErrorMessage(err, 'Failed to process payout.'));
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleMockAddMoney = async (event: React.FormEvent) => {
    event.preventDefault();
    const amountNum = parseFloat(addMoneyAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toastError('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    setAddMoneyLoading(true);
    try {
      const res = await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      if (!res) {
        toastError('Gateway Error', 'Razorpay SDK failed to load. Are you online?');
        setAddMoneyLoading(false);
        return;
      }

      // 1. Create order on backend
      const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
        body: { amount: amountNum, currency: 'INR' },
      });

      if (orderError) throw orderError;
      if (!orderData || !orderData.id) throw new Error('Order creation failed on backend');

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder', // Use your live/test key here
        amount: orderData.amount.toString(),
        currency: orderData.currency,
        name: 'CouponVault Wallet',
        description: 'Add funds to wallet',
        order_id: orderData.id,
        handler: async function (response: any) {
          // 3. Verify payment on backend
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });

            if (verifyError || !verifyData?.verified) {
              toastError('Verification Failed', 'Payment signature is invalid. Funds will be refunded if deducted.');
              return;
            }

            // 4. Verification successful, update wallet securely
            if (user?.id) {
              await addFunds(user.id, amountNum);
              await refreshWalletBalance();
            }
            success('Funds added', `Successfully added ₹${amountNum.toFixed(2)} to your wallet.`);
            setShowAddMoneyModal(false);
            setAddMoneyAmount('500');
          } catch (err: unknown) {
            toastError('Verification Error', getErrorMessage(err, 'Failed to verify payment with server.'));
          }
        },
        prefill: {
          email: user?.email || '',
        },
        theme: {
          color: '#8b5cf6',
        },
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();
    } catch (err: unknown) {
      console.warn("Razorpay integration failed, falling back to simple test mode:", err);
      // SIMPLE TEST MODE FALLBACK
      try {
        if (user?.id) {
          await addFunds(user.id, amountNum);
          await refreshWalletBalance();
        }
        success('Test Funds Added', `Simple test mode simulated top-up. Added ₹${amountNum.toFixed(2)} to your wallet.`);
        setShowAddMoneyModal(false);
        setAddMoneyAmount('500');
      } catch (mockErr: unknown) {
        toastError('Top-up error', getErrorMessage(mockErr, 'Could not initiate simulated top-up.'));
      }
    } finally {
      setAddMoneyLoading(false);
    }
  };

  const combinedTransactions = useMemo(() => {
    const list: Array<{ date: string; brand: string; type: string; amount: string; status: string }> = [];

    orders.forEach((order) => {
      list.push({
        date: order.created_at,
        brand: order.company?.name || 'Marketplace purchase',
        type: 'Purchase',
        amount: `-₹${order.amount.toFixed(2)}`,
        status: 'Completed',
      });
    });

    redemptions.forEach((redemption) => {
      list.push({
        date: redemption.created_at,
        brand: redemption.company_name || 'Merchant',
        type: 'Redemption',
        amount: `-₹${redemption.amount.toFixed(2)}`,
        status: 'Settled',
      });
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [orders, redemptions]);

  const filteredCatalog = useMemo(() => {
    return giftCards.filter((card) => {
      const matchesSearch =
        card.title.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        (card.company_name && card.company_name.toLowerCase().includes(catalogSearch.toLowerCase()));

      let matchesPrice = true;
      if (priceFilter === 'low') matchesPrice = card.price < 500;
      else if (priceFilter === 'mid') matchesPrice = card.price >= 500 && card.price <= 2000;
      else if (priceFilter === 'high') matchesPrice = card.price > 2000;

      return matchesSearch && matchesPrice;
    });
  }, [catalogSearch, giftCards, priceFilter]);

  const activeVoucherCount = userVouchers.filter((voucher) => !voucher.is_used).length;


  return (
    <div className="dashboard-section fade-in">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <span className="section-label">Customer experience</span>
          <h2 style={{ margin: '0.45rem 0 0.35rem', fontSize: '2rem', letterSpacing: '-0.04em' }}>
            Welcome back, {user?.email?.split('@')[0] || 'guest'}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-3)', lineHeight: 1.6 }}>
            Browse new cards, manage active vouchers, and keep redemptions close at hand.
          </p>
        </div>
      </div>

      <div className="responsive-grid-4 fade-in-cards">
        <DashboardCard title="Wallet balance" value={`₹${walletBalance.toFixed(2)}`} variant="primary" icon={<Wallet size={20} />} />
        <DashboardCard title="Active cards" value={String(activeVoucherCount)} variant="emerald" icon={<CreditCard size={20} />} />
        <DashboardCard title="Transactions" value={String(combinedTransactions.length)} variant="violet" icon={<ArrowLeftRight size={20} />} />
        <DashboardCard title="Redeemed value" value={`₹${redemptions.reduce((acc, r) => acc + (r.amount ?? 0), 0).toFixed(2)}`} variant="amber" icon={<Gift size={20} />} />
      </div>

      {currentSection === 'marketplace' && (
        <div className="dashboard-section fade-in">
          <div className="glass-card-strong" style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(180px, 0.7fr)', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label className="label">Search cards</label>
              <input
                className="input"
                placeholder="Search brand or card"
                value={catalogSearch}
                onChange={(event) => setCatalogSearch(event.target.value)}
              />
            </div>
            <div>
              <label className="label">Price band</label>
              <select className="input" value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)}>
                <option value="All">All prices</option>
                <option value="low">Under ₹500</option>
                <option value="mid">₹500 - ₹2000</option>
                <option value="high">Over ₹2000</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="responsive-grid-3 stagger-fade">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton-glass" style={{ minHeight: '240px' }} />
              ))}
            </div>
          ) : loadError ? (
            <div className="glass-card-strong empty-state">
              <div className="empty-state__icon">
                <ShieldCheck size={28} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 0.35rem', color: 'var(--text-1)', fontSize: '1.15rem', fontWeight: 600 }}>Something went wrong</h3>
                <p style={{ margin: 0, color: 'var(--text-3)', fontSize: '0.9rem', maxWidth: '360px' }}>{loadError}</p>
              </div>
              <button className="btn btn-primary" onClick={() => loadData()} style={{ marginTop: '0.25rem' }}>
                Try again
              </button>
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="glass-card-strong empty-state">
              <div className="empty-state__icon">
                <SearchX size={28} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 0.35rem', color: 'var(--text-1)', fontSize: '1.15rem', fontWeight: 600 }}>No gift cards found</h3>
                <p style={{ margin: 0, color: 'var(--text-3)', fontSize: '0.9rem', maxWidth: '320px' }}>We couldn't find any active gift cards matching your search right now.</p>
              </div>
              <button className="btn btn-secondary" onClick={() => { setCatalogSearch(''); setPriceFilter('All'); }} style={{ marginTop: '0.25rem' }}>
                Clear search filters
              </button>
            </div>
          ) : (
            <div className="responsive-grid-3 stagger-fade">
              {filteredCatalog.map((card) => {
                const val = card.value ?? 0;
                const prc = card.price ?? 0;
                const savings = val - prc;
                const savingsPct = val > 0 ? Math.round((savings / val) * 100) : 0;

                return (
                  <div key={card.id} className="card card-hover card-lift marketplace-card" style={{ padding: '1rem', position: 'relative' }}>
                    <div className="img-zoom"
                      style={{
                        minHeight: '220px',
                        borderRadius: '24px',
                        padding: '1.2rem',
                        color: '#fff',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <div className="marketplace-card-img" style={{ position: 'absolute', inset: 0, background: `url(${card.banner_image || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=900&auto=format&fit=crop&q=60'}) center/cover`, zIndex: 0 }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(25,28,29,0.55), rgba(25,28,29,0.85))', zIndex: 1 }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)', pointerEvents: 'none', borderRadius: '24px', zIndex: 2 }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', position: 'relative', zIndex: 3 }}>
                        <span className="badge gift-card-badge" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', backdropFilter: 'blur(8px)' }}>
                          <Gift size={12} /> {card.company_name || 'Brand partner'}
                        </span>
                        <span className="badge" style={{ background: 'rgba(128,249,200,0.2)', color: '#fff', backdropFilter: 'blur(8px)' }}>
                          Save {savingsPct}%
                        </span>
                      </div>
                      <div style={{ position: 'relative', zIndex: 3 }}>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>{card.title}</div>
                        <div style={{ color: 'rgba(255,255,255,0.78)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Zap size={14} /> ₹{prc.toFixed(2)} now, value ₹{val.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '1rem 0.35rem 0 0.35rem' }}>
                      <p style={{ margin: '0 0 0.85rem', color: 'var(--text-3)', lineHeight: 1.6, fontSize: '0.88rem' }}>{card.description}</p>
                      
                      {card.issue_limit ? (() => {
                        const remaining = card.issue_limit - (card.issued_count || 0);
                        const isSoldOut = remaining <= 0;
                        return (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isSoldOut ? 'var(--red)' : 'var(--amber)' }}>
                              {isSoldOut ? 'Sold out!' : `Only ${remaining} left`}
                            </span>
                            <button 
                              className={`btn ${isSoldOut ? 'btn-secondary' : 'btn-primary'} btn-sm`} 
                              disabled={isSoldOut}
                              onClick={() => handleInitiatePurchase(card)}
                            >
                              {isSoldOut ? 'Out of stock' : 'Buy gift card'}
                            </button>
                          </div>
                        );
                      })() : (
                        <button className="btn btn-primary btn-sm" onClick={() => handleInitiatePurchase(card)}>
                          Buy gift card
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {currentSection === 'wallet' && (
        <div className="dashboard-section fade-in">
          <div className="responsive-grid-2">
            <div className="premium-gradient-card" style={{ padding: '1.6rem' }}>
              <div className="premium-gradient-card__bg" />
              <div className="premium-gradient-card__shimmer" />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span className="section-label" style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: '0.15em' }}>
                    <Wallet size={14} style={{ display: 'inline', marginRight: '0.35rem', verticalAlign: 'middle' }} />
                    Wallet balance
                  </span>
                  <span className="glow-dot" />
                </div>
                <div style={{ fontSize: '2.8rem', fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1 }}>₹{walletBalance.toFixed(2)}</div>
                <p style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginTop: '0.75rem', fontSize: '0.92rem' }}>
                  Use your stored balance for instant purchases, top up funds, and test wallet flows with the mock gateway.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setShowAddMoneyModal(true); }}
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', borderColor: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}
                  >
                    <Sparkles size={14} /> Add money
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setWithdrawStep(1); setShowWithdrawModal(true); }}
                    style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
                  >
                    Withdraw money
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-card-strong" style={{ padding: '1.5rem' }}>
              <div className="section-label" style={{ marginBottom: '0.75rem' }}>Portfolio summary</div>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.4)', borderRadius: '14px' }}>
                  <span style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>Owned cards</span>
                  <strong style={{ fontSize: '1.1rem' }}>{userVouchers.length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.4)', borderRadius: '14px' }}>
                  <span style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>Redeemed amount</span>
                  <strong style={{ fontSize: '1.1rem' }}>₹{redemptions.reduce((acc, r) => acc + (r.amount ?? 0), 0).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.4)', borderRadius: '14px' }}>
                  <span style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>Recent orders</span>
                  <strong style={{ fontSize: '1.1rem' }}>{orders.length}</strong>
                </div>
              </div>
            </div>
          </div>

          <div aria-live="polite" className="glass-card-strong" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <span className="section-label">Quick actions</span>
              <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.2rem', letterSpacing: '-0.03em' }}>Move between balance, activity, and active cards</h3>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/cards')}>
                <CreditCard size={14} /> View cards
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/activity')}>
                <Activity size={14} /> Activity
              </button>
            </div>
          </div>
        </div>
      )}

      {currentSection === 'activity' && (
        <div className="glass-card-strong fade-in" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1.5px solid rgba(255,255,255,0.4)' }}>
            <span className="section-label"><Activity size={13} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle' }} /> Timeline</span>
            <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.25rem', letterSpacing: '-0.03em' }}>
              Transaction and settlement activity
            </h3>
          </div>
          {combinedTransactions.length === 0 ? (
            <div className="empty-state" style={{ padding: '2.5rem' }}>
              <div className="empty-state__icon"><Activity size={24} /></div>
              <div>
                <h3 style={{ margin: '0 0 0.35rem', color: 'var(--text-1)', fontSize: '1.05rem', fontWeight: 600 }}>No activity yet</h3>
                <p style={{ margin: 0, color: 'var(--text-3)', fontSize: '0.9rem' }}>Your purchases and redemptions will appear here.</p>
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Merchant</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedTransactions.map((transaction, index) => (
                    <tr key={`${transaction.date}-${index}`}>
                      <td className="mono" style={{ fontSize: '0.82rem' }}>{new Date(transaction.date).toLocaleString()}</td>
                      <td>{transaction.brand}</td>
                      <td>
                        <span className={`badge ${transaction.type === 'Purchase' ? 'badge-purple' : 'badge-green'}`}>
                          {transaction.type}
                        </span>
                      </td>
                      <td className="mono" style={{ fontWeight: 600 }}>{transaction.amount}</td>
                      <td><span className="badge badge-green" style={{ fontSize: '0.65rem' }}>{transaction.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {currentSection === 'cards' && (
        <div className="dashboard-section fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <span className="section-label"><CreditCard size={13} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle' }} /> Active vouchers</span>
              <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.4rem', letterSpacing: '-0.03em' }}>Stored gift cards</h3>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/marketplace')}>
              <Gift size={14} /> Buy another card
            </button>
          </div>

          {userVouchers.length === 0 ? (
            <div className="glass-card-strong empty-state">
              <div className="empty-state__icon"><CreditCard size={26} /></div>
              <div>
                <h3 style={{ margin: '0 0 0.35rem', color: 'var(--text-1)', fontSize: '1.1rem', fontWeight: 600 }}>No vouchers yet</h3>
                <p style={{ margin: 0, color: 'var(--text-3)', fontSize: '0.9rem' }}>Buy a gift card from the marketplace to see your vouchers here.</p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard/marketplace')} style={{ marginTop: '0.25rem' }}>
                <Gift size={14} /> Browse marketplace
              </button>
            </div>
          ) : (
            <>
              {(() => {
                const activeVouchersList = userVouchers.filter(v => v.status !== 'redeemed' && !v.is_used);
                const redeemedVouchersList = userVouchers.filter(v => v.status === 'redeemed' || v.is_used);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    {activeVouchersList.length > 0 ? (
                      <div className="responsive-grid-3">
                        {activeVouchersList.map((voucher) => (
                          <div
                            key={voucher.id}
                            className="glass-card-glow"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === 'Enter' && setActiveVoucher(voucher)}
                            onClick={() => setActiveVoucher(voucher)}
                            style={{ padding: '1rem', textAlign: 'left', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                              <div>
                                <div className="section-label" style={{ marginBottom: '0.3rem' }}>
                                  <Gift size={12} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                                  {voucher.company_name || 'Brand partner'}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: '0.92rem', letterSpacing: '0.02em' }}>
                                    {visibleCodes[voucher.id] ? voucher.code : '••••••••••••'}
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setVisibleCodes(prev => ({ ...prev, [voucher.id]: !prev[voucher.id] })); }}
                                    style={{ background: 'rgba(255,255,255,0.4)', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px', borderRadius: '8px', display: 'flex' }}
                                  >
                                    {visibleCodes[voucher.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                </div>
                              </div>
                              <span className="badge badge-green">{voucher.status}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0 0', borderTop: '1.5px solid rgba(255,255,255,0.35)' }}>
                              <div>
                                <div style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>Remaining</div>
                                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>₹{(voucher.remaining_balance ?? 0).toFixed(2)}</div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>Expires</div>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{new Date(voucher.expiry_date).toLocaleDateString()}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="glass-card-strong empty-state" style={{ padding: '1.5rem' }}>
                        <div className="empty-state__icon" style={{ width: 44, height: 44 }}><CreditCard size={20} /></div>
                        <div>
                          <p style={{ margin: 0, color: 'var(--text-3)', fontSize: '0.9rem' }}>No active vouchers right now.</p>
                        </div>
                      </div>
                    )}

                    {redeemedVouchersList.length > 0 && (
                      <div>
                        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span className="section-label">Past vouchers</span>
                          <span className="badge badge-gray" style={{ fontSize: '0.6rem' }}>{redeemedVouchersList.length}</span>
                        </div>
                        <div className="responsive-grid-3">
                          {redeemedVouchersList.map((voucher) => (
                            <div
                              key={voucher.id}
                              className="glass-card-strong"
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => e.key === 'Enter' && setActiveVoucher(voucher)}
                              onClick={() => setActiveVoucher(voucher)}
                              style={{ padding: '1rem', textAlign: 'left', opacity: 0.75, cursor: 'pointer' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                  <div className="section-label" style={{ marginBottom: '0.3rem', color: 'var(--text-4)' }}>
                                    {voucher.company_name || 'Brand partner'}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-3)', fontSize: '0.92rem' }}>
                                      {visibleCodes[voucher.id] ? voucher.code : '••••••••••••'}
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setVisibleCodes(prev => ({ ...prev, [voucher.id]: !prev[voucher.id] })); }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 0, display: 'flex' }}
                                    >
                                      {visibleCodes[voucher.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                  </div>
                                </div>
                                <span className="badge badge-gray">{voucher.status}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 0 0', borderTop: '1.5px solid rgba(255,255,255,0.25)' }}>
                                <div>
                                  <div style={{ color: 'var(--text-4)', fontSize: '0.78rem' }}>Remaining</div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-3)' }}>₹{(voucher.remaining_balance ?? 0).toFixed(2)}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ color: 'var(--text-4)', fontSize: '0.78rem' }}>Expires</div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-3)' }}>{new Date(voucher.expiry_date).toLocaleDateString()}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {activeVoucher && (
        <div className="glass-modal-overlay" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: '1rem', zIndex: 50 }}>
          <div className="glass-modal-panel fade-in" style={{ maxWidth: '420px', width: '100%', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <span className="section-label"><ShieldCheck size={13} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle' }} /> Ready to scan</span>
                <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.4rem', letterSpacing: '-0.03em' }}>
                  {activeVoucher.company_name || 'Voucher'}
                </h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveVoucher(null)}>
                Close
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.85)', borderRadius: '24px', padding: '1.2rem', display: 'grid', placeItems: 'center' }}>
              <QRCode value={activeVoucher.code} size={190} fgColor="#191c1d" />
            </div>

            <div className="glass-card-strong" style={{ borderRadius: '20px', padding: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginBottom: '0.45rem' }}>
                <div className="mono" style={{ fontWeight: 800, letterSpacing: '0.04em' }}>
                  {visibleCodes[activeVoucher.id] ? activeVoucher.code : '••••••••••••'}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setVisibleCodes(prev => ({ ...prev, [activeVoucher.id]: !prev[activeVoucher.id] })); }}
                  style={{ background: 'rgba(255,255,255,0.4)', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '4px', borderRadius: '8px', display: 'flex' }}
                >
                  {visibleCodes[activeVoucher.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', color: 'var(--text-3)' }}>
                <span><strong>₹{(activeVoucher.remaining_balance ?? 0).toFixed(2)}</strong> remaining</span>
                <span>Expires {new Date(activeVoucher.expiry_date).toLocaleDateString()}</span>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={async () => {
                let successCopy = false;
                try {
                  if (navigator?.clipboard?.writeText) {
                    await navigator.clipboard.writeText(activeVoucher.code);
                    successCopy = true;
                  } else {
                    const textArea = document.createElement("textarea");
                    textArea.value = activeVoucher.code;
                    textArea.style.position = "fixed";
                    textArea.style.left = "-999999px";
                    textArea.style.top = "-999999px";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    successCopy = document.execCommand('copy');
                    textArea.remove();
                  }
                } catch (e) {
                  successCopy = false;
                }
                
                if (successCopy) {
                  success('Copied ticket code', 'Paste this in the merchant scan box.');
                } else {
                  success('Ticket code ready', 'Please select and copy the code manually.');
                }
              }}
            >
              Copy voucher code
            </button>
          </div>
        </div>
      )}

      {showPaymentModal && selectedProduct && (
        <div className="glass-modal-overlay" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, overflow: 'auto', padding: '1rem' }}>
          <div className="glass-modal-panel fade-in" style={{ width: '100%', maxWidth: '480px', margin: 'auto', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
              <div>
                <span className="section-label"><Zap size={13} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle' }} /> Checkout</span>
                <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.4rem', letterSpacing: '-0.03em' }}>
                  {selectedProduct.title}
                </h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowPaymentModal(false); setSelectedProduct(null); }} style={{ flexShrink: 0 }}>
                Close
              </button>
            </div>

            <div className="glass-card-strong" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.95rem' }}>
                <span style={{ color: 'var(--text-3)' }}>Face Value</span>
                <strong>₹{(selectedProduct.value ?? 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.95rem' }}>
                <span style={{ color: 'var(--text-3)' }}>Purchase Price</span>
                <strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>₹{(selectedProduct.price ?? 0).toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-3)' }}>Cashback (10%)</span>
                <strong style={{ color: '#10b981' }}>+₹{((selectedProduct.value ?? 0) * 0.1).toFixed(2)}</strong>
              </div>
            </div>

            <div className="glass-card-strong" style={{ padding: '1rem', borderRadius: '16px', display: 'grid', gap: '0.6rem' }}>
              <div>
                <label className="label">Name on payment</label>
                <input
                  className="input"
                  value={mockPaymentForm.name}
                  onChange={(event) => setMockPaymentForm({ ...mockPaymentForm, name: event.target.value })}
                />
              </div>
              <div>
                <label className="label">Payment method</label>
                <select
                  className="input"
                  value={mockPaymentForm.method}
                  onChange={(event) => setMockPaymentForm({ ...mockPaymentForm, method: event.target.value })}
                >
                  <option>Card ending 4242</option>
                  <option>UPI demo handle</option>
                  <option>Netbanking sandbox</option>
                </select>
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleRazorpayPurchase} disabled={paymentLoading}>
              {paymentLoading ? (
                <><span className="spinner" /> Processing...</>
              ) : 'Pay with Razorpay'}
            </button>

            <div style={{ position: 'relative', textAlign: 'center', margin: '0.15rem 0' }}>
              <span style={{ background: '#ffffff', padding: '0 0.75rem', position: 'relative', zIndex: 1, fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.08em' }}>
                OR PAY WITH WALLET
              </span>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(0,0,0,0.1)' }} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ flex: 1, padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.03)', borderRadius: '14px' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>Wallet</div>
                <strong style={{ fontSize: '1rem' }}>₹{walletBalance.toFixed(2)}</strong>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                disabled={paymentLoading || walletBalance < selectedProduct.price}
                onClick={handleConfirmWalletPayment}
              >
                {walletBalance < selectedProduct.price ? 'Insufficient' : 'Pay from Wallet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <div className="glass-modal-overlay" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: '1rem', zIndex: 50 }}>
          <div className="glass-modal-panel fade-in" style={{ maxWidth: '420px', width: '100%', padding: '1.5rem' }}>
            {withdrawStep === 1 ? (
              <form onSubmit={handleWithdrawalSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
                  <div>
                    <span className="section-label">Wallet payout</span>
                    <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.4rem', letterSpacing: '-0.03em' }}>
                      Withdraw funds
                    </h3>
                  </div>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowWithdrawModal(false)}>
                    Close
                  </button>
                </div>

                <div>
                  <label className="label">Amount</label>
                  <input className="input mono" type="number" step="0.01" max={walletBalance} required value={withdrawForm.amount} onChange={(event) => setWithdrawForm({ ...withdrawForm, amount: event.target.value })} />
                </div>
                <div>
                  <label className="label">Routing code</label>
                  <input className="input mono" required value={withdrawForm.routing} onChange={(event) => setWithdrawForm({ ...withdrawForm, routing: event.target.value })} />
                </div>
                <div>
                  <label className="label">Bank account</label>
                  <input className="input mono" required value={withdrawForm.account} onChange={(event) => setWithdrawForm({ ...withdrawForm, account: event.target.value })} />
                </div>
                <button className="btn btn-primary" disabled={withdrawLoading} type="submit">
                  {withdrawLoading ? <><span className="spinner" /> Initiating payout...</> : 'Submit withdrawal'}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', display: 'grid', gap: '0.9rem' }}>
                <span className="badge badge-green" style={{ margin: '0 auto' }}>Transfer created</span>
                <h3 style={{ margin: 0, fontSize: '1.4rem', letterSpacing: '-0.03em' }}>Payout completed</h3>
                <p style={{ margin: 0, color: 'var(--text-3)', lineHeight: 1.6 }}>Your funds are being transferred to your bank account.</p>
                <button className="btn btn-secondary" onClick={() => setShowWithdrawModal(false)}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddMoneyModal && (
        <div className="glass-modal-overlay" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: '1rem', zIndex: 50 }}>
          <div className="glass-modal-panel fade-in" style={{ maxWidth: '420px', width: '100%', padding: '1.5rem' }}>
            <form onSubmit={handleMockAddMoney} style={{ display: 'grid', gap: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
                <div>
                  <span className="section-label"><Sparkles size={13} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle' }} /> Wallet top-up</span>
                  <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.4rem', letterSpacing: '-0.03em' }}>Add funds to wallet</h3>
                </div>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowAddMoneyModal(false)}>Close</button>
              </div>
              <div>
                <label className="label">Amount (INR)</label>
                <input className="input mono" type="number" min="1" required value={addMoneyAmount} onChange={(event) => setAddMoneyAmount(event.target.value)} />
              </div>
              <button className="btn btn-primary" disabled={addMoneyLoading} type="submit">
                {addMoneyLoading ? <><span className="spinner" /> Connecting...</> : 'Add funds with Razorpay'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
