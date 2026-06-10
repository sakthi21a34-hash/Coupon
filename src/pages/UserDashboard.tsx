import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCode } from 'react-qr-code';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, SearchX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
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
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();

  const currentSection: UserSection = isUserSection(section) ? section : 'marketplace';

  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [userVouchers, setUserVouchers] = useState<Coupon[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionTransaction[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (!userId) return;

    try {
      setLoading(true);
      const [cards, vouchers, userOrders, userRedemptions] = await Promise.all([
        getGiftCards(),
        getUserGiftCards(userId),
        getUserOrders(userId),
        getRedemptionTransactions(),
      ]);

      setGiftCards(cards);
      setUserVouchers(vouchers);
      setOrders(userOrders);

      const voucherIds = vouchers.map((voucher) => voucher.id);
      setRedemptions(userRedemptions.filter((redemption) => voucherIds.includes(redemption.coupon_id)));
    } catch (err: unknown) {
      toastErrorRef.current('Load error', getErrorMessage(err, 'Failed to load dashboard details.'));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const syncDashboard = async () => {
      await loadData();
    };

    void syncDashboard();
  }, [loadData]);

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

  const statCards = [
    { label: 'Wallet balance', value: `₹${walletBalance.toFixed(2)}` },
    { label: 'Active cards', value: String(activeVoucherCount) },
    { label: 'Transactions', value: String(combinedTransactions.length) },
  ];


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

      <div className="responsive-grid-4">
        {statCards.map((card) => (
          <div key={card.label} className="card" style={{ padding: '1.25rem' }}>
            <div className="section-label" style={{ marginBottom: '0.5rem' }}>
              {card.label}
            </div>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-0.04em' }}>{card.value}</div>
          </div>
        ))}
      </div>

      {currentSection === 'marketplace' && (
        <div className="dashboard-section">
          <div
            className="card"
            style={{
              padding: '1.25rem',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.5fr) minmax(180px, 0.7fr)',
              gap: '1rem',
            }}
          >
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
            <div className="responsive-grid-3 fade-in-cards">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card skeleton" style={{ minHeight: '220px', padding: '1rem' }} />
              ))}
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'var(--surface-soft)', padding: '1rem', borderRadius: '50%', color: 'var(--text-3)' }}>
                <SearchX size={32} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-1)', fontSize: '1.2rem', fontWeight: 600 }}>No gift cards found</h3>
                <p style={{ margin: 0, color: 'var(--text-3)', fontSize: '0.95rem' }}>We couldn't find any active gift cards matching your search right now.</p>
              </div>
              <button className="btn btn-secondary" onClick={() => { setCatalogSearch(''); setPriceFilter('All'); }} style={{ marginTop: '0.5rem' }}>
                Clear search filters
              </button>
            </div>
          ) : (
            <div className="responsive-grid-3 fade-in-cards">
              {filteredCatalog.map((card) => {
                const val = card.value ?? 0;
                const prc = card.price ?? 0;
                const savings = val - prc;
                const savingsPct = val > 0 ? Math.round((savings / val) * 100) : 0;

                return (
                  <div key={card.id} className="card card-hover" style={{ padding: '1rem' }}>
                    <div
                      style={{
                        minHeight: '220px',
                        borderRadius: '24px',
                        padding: '1.2rem',
                        color: '#fff',
                        background: `linear-gradient(160deg, rgba(25,28,29,0.6), rgba(25,28,29,0.8)), url(${card.banner_image || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=900&auto=format&fit=crop&q=60'}) center/cover`,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <span className="badge" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}>
                          {card.company_name || 'Brand partner'}
                        </span>
                        <span className="badge" style={{ background: 'rgba(128,249,200,0.2)', color: '#fff' }}>
                          Save {savingsPct}%
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>{card.title}</div>
                        <div style={{ color: 'rgba(255,255,255,0.78)', marginTop: '0.25rem' }}>
                          ₹{prc.toFixed(2)} now, value ₹{val.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '1rem 0.35rem 0 0.35rem' }}>
                      <p style={{ margin: '0 0 0.75rem', color: 'var(--text-3)', lineHeight: 1.6 }}>{card.description}</p>
                      
                      {card.issue_limit ? (() => {
                        const remaining = card.issue_limit - (card.issued_count || 0);
                        const isSoldOut = remaining <= 0;
                        return (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isSoldOut ? 'var(--red)' : 'var(--orange)' }}>
                              {isSoldOut ? 'Sold out!' : `Only ${remaining} left!`}
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
        <div className="dashboard-section">
          <div className="responsive-grid-2">
            <div
              className="card"
              style={{
                padding: '1.6rem',
                background: 'linear-gradient(160deg, rgba(124,58,237,0.98), rgba(79,8,180,0.98))',
                color: '#fff',
              }}
            >
              <div style={{ marginBottom: '1.5rem' }}>
                <span className="section-label" style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: '0.15em' }}>Wallet balance</span>
                <div style={{ fontSize: '2.6rem', fontWeight: 800, letterSpacing: '-0.05em' }}>₹{walletBalance.toFixed(2)}</div>
                <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
                  Use your stored balance for instant purchases, top up funds, and test wallet flows with the mock gateway.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setShowAddMoneyModal(true);
                    }}
                  >
                    Add money
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setWithdrawStep(1);
                      setShowWithdrawModal(true);
                    }}
                  >
                    Withdraw money
                  </button>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '1.5rem' }}>
              <div className="section-label" style={{ marginBottom: '0.5rem' }}>
                Portfolio summary
              </div>
              <div style={{ display: 'grid', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>Owned cards</span>
                  <strong>{userVouchers.length}</strong>
                </div>
                <div className="stats-grid">
                  <div className="stat-card fade-in" style={{ background: 'var(--bg-3)', animationDelay: '0.1s' }}>
                    <span style={{ color: 'var(--text-3)' }}>Redeemed amount</span>
                    <strong>₹{redemptions.reduce((acc, redemption) => acc + (redemption.amount ?? 0), 0).toFixed(2)}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>Recent orders</span>
                  <strong>{orders.length}</strong>
                </div>
              </div>
            </div>
          </div>

          <div aria-live="polite" className="card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <span className="section-label">Next best actions</span>
              <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.35rem', letterSpacing: '-0.03em' }}>Move between balance, activity, and active cards</h3>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/cards')}>
                View my cards
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/activity')}>
                Open activity
              </button>
            </div>
          </div>
        </div>
      )}

      {currentSection === 'activity' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <span className="section-label">Timeline</span>
            <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.35rem', letterSpacing: '-0.03em' }}>
              Transaction and settlement activity
            </h3>
          </div>
          {combinedTransactions.length === 0 ? (
            <div style={{ padding: '2rem', color: 'var(--text-3)', textAlign: 'center' }}>No transactions recorded yet.</div>
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
                      <td className="mono">{new Date(transaction.date).toLocaleString()}</td>
                      <td>{transaction.brand}</td>
                      <td>
                        <span className={`badge ${transaction.type === 'Purchase' ? 'badge-purple' : 'badge-green'}`}>
                          {transaction.type}
                        </span>
                      </td>
                      <td className="mono">{transaction.amount}</td>
                      <td>{transaction.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {currentSection === 'cards' && (
        <div className="dashboard-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <span className="section-label">Active vouchers</span>
              <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.5rem', letterSpacing: '-0.03em' }}>Stored gift cards</h3>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/marketplace')}>
              Buy another card
            </button>
          </div>

          {userVouchers.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>
              No purchased vouchers yet. Buy one from the marketplace to start your wallet.
            </div>
          ) : (
            <>
              {(() => {
                const activeVouchersList = userVouchers.filter(v => v.status !== 'redeemed' && !v.is_used);
                const redeemedVouchersList = userVouchers.filter(v => v.status === 'redeemed' || v.is_used);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    {/* Active Vouchers Section */}
                    {activeVouchersList.length > 0 ? (
                      <div className="responsive-grid-3">
                        {activeVouchersList.map((voucher) => {
                          return (
                            <div
                              key={voucher.id}
                              className="card card-hover"
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => e.key === 'Enter' && setActiveVoucher(voucher)}
                              onClick={() => setActiveVoucher(voucher)}
                    style={{
                      padding: '1rem',
                      textAlign: 'left',
                      borderColor: 'var(--green-border)',
                      background: '#fff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <div className="section-label" style={{ marginBottom: '0.3rem' }}>
                          {voucher.company_name || 'Brand partner'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ fontWeight: 800, fontFamily: 'monospace' }}>
                            {visibleCodes[voucher.id] ? voucher.code : '••••••••••••'}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVisibleCodes(prev => ({ ...prev, [voucher.id]: !prev[voucher.id] }));
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, display: 'flex' }}
                          >
                            {visibleCodes[voucher.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <span className="badge badge-green">{voucher.status}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <div>
                        <div style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>Remaining</div>
                        <div style={{ fontWeight: 700 }}>₹{(voucher.remaining_balance ?? 0).toFixed(2)}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>Expires</div>
                        <div style={{ fontWeight: 700 }}>{new Date(voucher.expiry_date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-4)' }}>No active vouchers.</div>
            )}

            {/* Redeemed Vouchers Section */}
            {redeemedVouchersList.length > 0 && (
              <div>
                <div style={{ marginBottom: '1rem' }}>
                  <span className="section-label">Past vouchers</span>
                  <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', letterSpacing: '-0.02em', color: 'var(--text-3)' }}>Redeemed & Expired</h3>
                </div>
                <div className="responsive-grid-3">
                  {redeemedVouchersList.map((voucher) => {
                    return (
                      <div
                        key={voucher.id}
                        className="card card-hover"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setActiveVoucher(voucher)}
                        onClick={() => setActiveVoucher(voucher)}
                        style={{
                          padding: '1rem',
                          textAlign: 'left',
                          borderColor: 'var(--border)',
                          background: 'var(--bg-2)',
                          opacity: 0.8
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                          <div>
                            <div className="section-label" style={{ marginBottom: '0.3rem', color: 'var(--text-4)' }}>
                              {voucher.company_name || 'Brand partner'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-3)' }}>
                                {visibleCodes[voucher.id] ? voucher.code : '••••••••••••'}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVisibleCodes(prev => ({ ...prev, [voucher.id]: !prev[voucher.id] }));
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: 0, display: 'flex' }}
                              >
                                {visibleCodes[voucher.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>
                          <span className="badge badge-gray">{voucher.status}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                          <div>
                            <div style={{ color: 'var(--text-4)', fontSize: '0.82rem' }}>Remaining</div>
                            <div style={{ fontWeight: 700, color: 'var(--text-3)' }}>₹{(voucher.remaining_balance ?? 0).toFixed(2)}</div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-4)', fontSize: '0.82rem' }}>Expires</div>
                            <div style={{ fontWeight: 700, color: 'var(--text-3)' }}>{new Date(voucher.expiry_date).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(25, 28, 29, 0.45)',
            backdropFilter: 'blur(10px)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
            zIndex: 50,
          }}
        >
          <div className="card fade-in" style={{ maxWidth: '420px', width: '100%', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <span className="section-label">Ready to scan</span>
                <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.4rem', letterSpacing: '-0.03em' }}>
                  {activeVoucher.company_name || 'Voucher'}
                </h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveVoucher(null)}>
                Close
              </button>
            </div>

            <div style={{ background: '#fff', borderRadius: '24px', padding: '1.2rem', display: 'grid', placeItems: 'center' }}>
              <QRCode value={activeVoucher.code} size={190} fgColor="#191c1d" />
            </div>

            <div className="glass-card" style={{ borderRadius: '20px', padding: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginBottom: '0.45rem' }}>
                <div className="mono" style={{ fontWeight: 800 }}>
                  {visibleCodes[activeVoucher.id] ? activeVoucher.code : '••••••••••••'}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setVisibleCodes(prev => ({ ...prev, [activeVoucher.id]: !prev[activeVoucher.id] }));
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, display: 'flex' }}
                >
                  {visibleCodes[activeVoucher.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', color: 'var(--text-3)' }}>
                <span>Balance ₹{(activeVoucher.remaining_balance ?? 0).toFixed(2)}</span>
                <span>Expiry {new Date(activeVoucher.expiry_date).toLocaleDateString()}</span>
              </div>
            </div>

            <button
              className="btn btn-secondary"
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
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(25, 28, 29, 0.45)',
            backdropFilter: 'blur(10px)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
            zIndex: 50,
          }}
        >
          <div className="card fade-in" style={{ maxWidth: '460px', width: '100%', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <span className="section-label">Mock gateway</span>
                <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.4rem', letterSpacing: '-0.03em' }}>
                  {selectedProduct.title}
                </h3>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedProduct(null);
                }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="card" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                  <span style={{ color: 'var(--text-3)' }}>Face Value:</span>
                  <strong>₹{(selectedProduct.value ?? 0).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                  <span style={{ color: 'var(--text-3)' }}>Purchase Price:</span>
                  <strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>₹{(selectedProduct.price ?? 0).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Accrued Cashback (10%):</span>
                  <strong>+₹{((selectedProduct.value ?? 0) * 0.1).toFixed(2)}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div className="glass-card" style={{ padding: '1rem', borderRadius: '12px', display: 'grid', gap: '0.75rem' }}>
                  <div>
                    <label className="label">Name on payment</label>
                    <input
                      className="input"
                      value={mockPaymentForm.name}
                      onChange={(event) => setMockPaymentForm({ ...mockPaymentForm, name: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Mock payment method</label>
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

                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={handleRazorpayPurchase}
                  disabled={paymentLoading}
                >
                  {paymentLoading ? (
                    <>
                      <span className="spinner" />
                      Initializing Razorpay...
                    </>
                  ) : (
                    'Pay with Razorpay'
                  )}
                </button>

                <div style={{ position: 'relative', textAlign: 'center', margin: '0.5rem 0' }}>
                  <span style={{ background: '#fff', padding: '0 0.75rem', position: 'relative', zIndex: 1, fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600 }}>
                    OR PAY WITH WALLET
                  </span>
                  <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--border)' }} />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <div style={{ flex: 1, padding: '1rem', background: 'var(--bg-3)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>Wallet Balance</div>
                    <strong style={{ fontSize: '0.95rem' }}>₹{walletBalance.toFixed(2)}</strong>
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
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(25, 28, 29, 0.45)',
            backdropFilter: 'blur(10px)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
            zIndex: 50,
          }}
        >
          <div className="card fade-in" style={{ maxWidth: '420px', width: '100%', padding: '1.5rem' }}>
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
                  <input
                    className="input mono"
                    type="number"
                    step="0.01"
                    max={walletBalance}
                    required
                    value={withdrawForm.amount}
                    onChange={(event) => setWithdrawForm({ ...withdrawForm, amount: event.target.value })}
                  />
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
                  {withdrawLoading ? (
                    <>
                      <span className="spinner" />
                      Initiating payout...
                    </>
                  ) : (
                    'Submit withdrawal'
                  )}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', display: 'grid', gap: '0.9rem' }}>
                <span className="badge badge-green" style={{ margin: '0 auto' }}>
                  Transfer created
                </span>
                <h3 style={{ margin: 0, fontSize: '1.4rem', letterSpacing: '-0.03em' }}>Payout completed</h3>
                <p style={{ margin: 0, color: 'var(--text-3)', lineHeight: 1.6 }}>
                  Your funds are being transferred to your bank account.
                </p>
                <button className="btn btn-secondary" onClick={() => setShowWithdrawModal(false)}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddMoneyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(25, 28, 29, 0.45)',
            backdropFilter: 'blur(10px)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
            zIndex: 50,
          }}
        >
          <div className="card fade-in" style={{ maxWidth: '420px', width: '100%', padding: '1.5rem' }}>
            <form onSubmit={handleMockAddMoney} style={{ display: 'grid', gap: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
                <div>
                  <span className="section-label">Wallet top-up</span>
                  <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.4rem', letterSpacing: '-0.03em' }}>
                    Add funds to wallet
                  </h3>
                </div>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowAddMoneyModal(false)}>
                  Close
                </button>
              </div>

              <div>
                <label className="label">Amount (INR)</label>
                <input
                  className="input mono"
                  type="number"
                  min="1"
                  required
                  value={addMoneyAmount}
                  onChange={(event) => setAddMoneyAmount(event.target.value)}
                />
              </div>

              <button className="btn btn-primary" disabled={addMoneyLoading} type="submit">
                {addMoneyLoading ? (
                  <>
                    <span className="spinner" />
                    Connecting to Razorpay...
                  </>
                ) : (
                  'Add funds with Razorpay'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
