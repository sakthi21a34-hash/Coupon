import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import type { AdminPurchasedCoupon, AdminUser, Company, CompanyStats, GiftCard } from '../lib/supabase';
import {
  adminApproveCompany,
  adminGetPurchasedCoupons,
  adminGetUsers,
  adminRejectCompany,
  adminSuspendCompany,
  createCompany,
  deleteCompany,
  deleteGiftCard,
  getCompanies,
  getCompanyStats,
  getGiftCards,
  updateCompanyLimit,
} from '../lib/supabase';

const validSections = ['overview', 'partners', 'users', 'ledger', 'approvals', 'security', 'offers'] as const;
type AdminSection = (typeof validSections)[number];

function isAdminSection(value: string | undefined): value is AdminSection {
  return !!value && validSections.includes(value as AdminSection);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminDashboard() {
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();

  const currentSection: AdminSection = isAdminSection(section) ? section : 'overview';

  const [stats, setStats] = useState<CompanyStats[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', prefix: '', coupon_limit: 100 });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLimit, setEditingLimit] = useState<number>(100);
  const [editLoading, setEditLoading] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [lockedAccounts, setLockedAccounts] = useState<Record<string, boolean>>({});
  const [usersPage, setUsersPage] = useState(0);

  const [purchasedCoupons, setPurchasedCoupons] = useState<AdminPurchasedCoupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponSearch, setCouponSearch] = useState('');
  const [couponFilter, setCouponFilter] = useState<'all' | 'active' | 'redeemed'>('all');
  const [couponsPage, setCouponsPage] = useState(0);
  const pageSize = 15;

  const [offers, setOffers] = useState<GiftCard[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [deletingOfferId, setDeletingOfferId] = useState<string | null>(null);

  const [viewingDoc, setViewingDoc] = useState<string | null>(null);

  const securityLogs = [
    { time: '2026-05-18 14:32:01', event: 'High frequency redemptions', detail: 'User usr_732 claimed 12 coupons in 45 seconds.', severity: 'High', target: 'Acme Corp' },
    { time: '2026-05-18 11:15:40', event: 'Rapid balance fluctuation', detail: 'Wallet value rose by ₹48.50 in under one minute.', severity: 'Medium', target: 'usr_902' },
    { time: '2026-05-17 09:44:12', event: 'Multiple failed scan attempts', detail: 'Invalid UUID token signature processed by one counter node.', severity: 'Low', target: 'Register Counter Node B' },
  ] as const;

  useEffect(() => {
    if (!section) {
      navigate('/admin/overview', { replace: true });
      return;
    }

    if (!isAdminSection(section)) {
      navigate('/admin/overview', { replace: true });
    }
  }, [navigate, section]);

  // Stable ref for toastError so it never invalidates useCallback
  const toastErrorRef = useRef(toastError);
  useEffect(() => { toastErrorRef.current = toastError; }, [toastError]);

  const loadCompanies = useCallback(async () => {
    try {
      setLoadingCompanies(true);
      const [statsData, allCompanies] = await Promise.all([getCompanyStats(), getCompanies()]);
      setStats(statsData);
      setCompanies(allCompanies);
    } catch (err: unknown) {
      toastErrorRef.current('Load failed', getErrorMessage(err, 'Failed to load companies.'));
    } finally {
      setLoadingCompanies(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usersPageRef = useRef(usersPage);
  useEffect(() => { usersPageRef.current = usersPage; }, [usersPage]);

  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const data = await adminGetUsers(usersPageRef.current, pageSize);
      setUsers(data);
    } catch (err: unknown) {
      toastErrorRef.current('Load users failed', getErrorMessage(err, 'Failed to load users.'));
    } finally {
      setUsersLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const couponsPageRef = useRef(couponsPage);
  useEffect(() => { couponsPageRef.current = couponsPage; }, [couponsPage]);

  const loadCoupons = useCallback(async () => {
    try {
      setCouponsLoading(true);
      const data = await adminGetPurchasedCoupons(couponsPageRef.current, pageSize);
      setPurchasedCoupons(data);
    } catch (err: unknown) {
      toastErrorRef.current('Load error', getErrorMessage(err, 'Failed to fetch ledger.'));
    } finally {
      setCouponsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOffers = useCallback(async () => {
    try {
      setOffersLoading(true);
      const data = await getGiftCards();
      setOffers(data);
    } catch (err: unknown) {
      toastErrorRef.current('Load error', getErrorMessage(err, 'Failed to fetch offers.'));
    } finally {
      setOffersLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when page number changes
  useEffect(() => { if (currentSection === 'users') loadUsers(); }, [usersPage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (currentSection === 'ledger') loadCoupons(); }, [couponsPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentSection === 'overview' || currentSection === 'partners' || currentSection === 'approvals') {
      loadCompanies();
    }
    if (currentSection === 'users') {
      loadUsers();
    }
    if (currentSection === 'ledger') {
      loadCoupons();
    }
    if (currentSection === 'offers') {
      loadOffers();
    }
  }, [currentSection]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingCompanies = useMemo(() => companies.filter((company) => company.status === 'pending'), [companies]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const query = userSearch.toLowerCase();
      return user.email.toLowerCase().includes(query) || user.id.toLowerCase().includes(query);
    });
  }, [userSearch, users]);

  const filteredCoupons = useMemo(() => {
    return purchasedCoupons.filter((coupon) => {
      const query = couponSearch.toLowerCase();
      const matchesSearch =
        coupon.coupon_code.toLowerCase().includes(query) ||
        coupon.company_name.toLowerCase().includes(query) ||
        (coupon.user_email || '').toLowerCase().includes(query);

      const matchesFilter =
        couponFilter === 'all' ? true : couponFilter === 'active' ? !coupon.is_used : coupon.is_used;

      return matchesSearch && matchesFilter;
    });
  }, [couponFilter, couponSearch, purchasedCoupons]);

  const platformGtv = useMemo(() => {
    return purchasedCoupons.reduce((sum, coupon) => sum + (coupon.price || 0), 0);
  }, [purchasedCoupons]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setFormError('');

    if (!/^[A-Za-z]{3}$/.test(form.prefix)) {
      setFormError('Prefix must be exactly 3 letters (A-Z).');
      return;
    }

    setFormLoading(true);
    try {
      await createCompany(form.name.trim(), form.prefix.toUpperCase(), form.coupon_limit);
      setForm({ name: '', prefix: '', coupon_limit: 100 });
      setShowForm(false);
      success('Company created', `${form.name.trim()} has been added to the platform.`);
      loadCompanies();
    } catch (err: unknown) {
      setFormError(getErrorMessage(err, 'Failed to create company.'));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleUpdateLimit(id: string, name: string) {
    if (editingLimit <= 0) {
      toastError('Invalid limit', 'Limit must be at least 1.');
      return;
    }

    setEditLoading(true);
    try {
      await updateCompanyLimit(id, editingLimit);
      success('Limit updated', `Voucher capacity for ${name} is now ${editingLimit}.`);
      setEditingId(null);
      loadCompanies();
    } catch (err: unknown) {
      toastError('Update failed', getErrorMessage(err, 'Failed to update company limit.'));
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This action cannot be undone.`)) return;

    setDeletingId(id);
    try {
      await deleteCompany(id);
      success('Company deleted', `${name} has been removed from the platform.`);
      loadCompanies();
    } catch (err: unknown) {
      toastError('Delete failed', getErrorMessage(err, 'Failed to delete company.'));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSuspend(id: string, name: string) {
    setSuspendingId(id);
    try {
      await adminSuspendCompany(id);
      success('Partner suspended', `${name} has been moved to suspended status.`);
      loadCompanies();
    } catch (err: unknown) {
      toastError('Suspend failed', getErrorMessage(err, 'Failed to suspend company.'));
    } finally {
      setSuspendingId(null);
    }
  }

  async function handleApproveMerchant(id: string, name: string) {
    try {
      await adminApproveCompany(id);
      success('Merchant approved', `${name} is now approved to launch gift card campaigns.`);
      loadCompanies();
    } catch (err: unknown) {
      toastError('Approval failed', getErrorMessage(err, 'Failed to approve merchant.'));
    }
  }

  async function handleRejectMerchant(id: string, name: string) {
    try {
      await adminRejectCompany(id);
      success('Merchant rejected', `KYC request for ${name} has been rejected.`);
      loadCompanies();
    } catch (err: unknown) {
      toastError('Rejection failed', getErrorMessage(err, 'Failed to reject merchant.'));
    }
  }

  function toggleLockAccount(userId: string) {
    setLockedAccounts((previous) => {
      const nextState = !previous[userId];
      success(nextState ? 'Account locked' : 'Account unlocked', 'Profile security status adjusted.');
      return { ...previous, [userId]: nextState };
    });
  }

  const handleDeleteOffer = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to completely remove the campaign "${title}" globally?`)) return;
    try {
      setDeletingOfferId(id);
      await deleteGiftCard(id);
      success('Offer deleted', `"${title}" has been removed globally.`);
      await loadOffers();
    } catch (err: unknown) {
      toastError('Deletion failed', getErrorMessage(err, 'Failed to delete offer.'));
    } finally {
      setDeletingOfferId(null);
    }
  };



  const titleMap: Record<AdminSection, string> = {
    overview: 'Platform operations at a glance',
    partners: 'Manage corporate partners and limits',
    offers: 'Manage global marketplace campaigns',
    users: 'Monitor platform users and roles',
    ledger: 'Track all issued and purchased vouchers',
    approvals: 'Review pending merchant applications',
    security: 'Security alerts and platform anomalies',
  };

  return (
    <div className="dashboard-section fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <span className="section-label">Administration control panel</span>
          <h2 style={{ margin: '0.45rem 0 0.35rem', fontSize: '2rem', letterSpacing: '-0.04em' }}>{titleMap[currentSection]}</h2>
          <p style={{ margin: 0, color: 'var(--text-3)', lineHeight: 1.6 }}>
            Monitor partner performance, user activity, approvals, and risk from one admin workspace.
          </p>
        </div>
      </div>

      <div className="responsive-grid-4">
        {[
          { label: 'Platform GTV', value: `₹${platformGtv.toFixed(2)}`, color: 'var(--green)' },
          { label: 'Pending approvals', value: String(pendingCompanies.length), color: 'var(--cyan)' },
          { label: 'Partners', value: String(companies.length), color: 'var(--text-1)' },
          { label: 'Security threats', value: String(securityLogs.length), color: 'var(--red)' },
        ].map((stat) => (
          <div key={stat.label} className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', margin: '0 0 0.625rem' }}>{stat.label}</p>
            <p className="mono" style={{ fontSize: '2rem', fontWeight: 800, color: stat.color, margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {currentSection === 'overview' && (
        <div className="dashboard-section">
          <div className="responsive-grid-2">
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <span className="section-label">Approval queue</span>
                  <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.35rem' }}>Partners waiting for review</h3>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/approvals')}>
                  Open queue
                </button>
              </div>
              {pendingCompanies.length === 0 ? (
                <div style={{ color: 'var(--text-3)' }}>No pending KYC approvals right now.</div>
              ) : (
                <div style={{ display: 'grid', gap: '0.85rem' }}>
                  {pendingCompanies.slice(0, 3).map((company) => (
                    <div key={company.id} className="glass-card" style={{ borderRadius: '20px', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <strong>{company.name}</strong>
                        <span className="badge badge-amber">{company.status}</span>
                      </div>
                      <div className="mono" style={{ marginTop: '0.4rem', color: 'var(--text-3)' }}>
                        {company.gstin || 'GSTIN pending'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <span className="section-label">Recent purchases</span>
                  <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.35rem' }}>Latest voucher activity</h3>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/ledger')}>
                  Open ledger
                </button>
              </div>
              {filteredCoupons.length === 0 ? (
                <div style={{ color: 'var(--text-3)' }}>No voucher purchases have been recorded yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: '0.85rem' }}>
                  {filteredCoupons.slice(0, 4).map((coupon) => (
                    <div key={coupon.coupon_id} className="glass-card" style={{ borderRadius: '20px', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <strong className="mono">{coupon.coupon_code}</strong>
                        <span className={`badge ${coupon.is_used ? 'badge-cyan' : 'badge-green'}`}>{coupon.is_used ? 'Redeemed' : 'Active'}</span>
                      </div>
                      <div style={{ color: 'var(--text-3)', marginTop: '0.35rem' }}>{coupon.company_name} by {coupon.user_email || 'anonymous'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentSection === 'partners' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm((current) => !current)}>
              {showForm ? 'Cancel' : 'New partner'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreate} className="card fade-in" style={{ padding: '1.5rem', borderColor: 'var(--cyan-border)' }}>
              <p style={{ fontWeight: 700, color: 'var(--text-1)', margin: '0 0 1.25rem', fontSize: '0.95rem' }}>New partner brand setup</p>
              <div className="responsive-grid-3">
                <div>
                  <label className="label">Brand name</label>
                  <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                </div>
                <div>
                  <label className="label">Prefix</label>
                  <input className="input mono" value={form.prefix} onChange={(event) => setForm({ ...form, prefix: event.target.value.toUpperCase().replace(/[^A-Z]/g, '') })} required maxLength={3} />
                </div>
                <div>
                  <label className="label">Initial global card limit</label>
                  <input className="input mono" type="number" min={1} value={form.coupon_limit} onChange={(event) => setForm({ ...form, coupon_limit: parseInt(event.target.value, 10) || 100 })} required />
                </div>
              </div>
              {formError && <p style={{ color: 'var(--red)', fontSize: '0.8rem', margin: '1rem 0 0 0', fontWeight: 500 }}>{formError}</p>}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button type="submit" disabled={formLoading} className="btn btn-primary btn-sm">
                  {formLoading ? 'Registering...' : 'Confirm registration'}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowForm(false); setFormError(''); }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="card" style={{ padding: '1.5rem' }}>
            {loadingCompanies ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}><div className="spinner" /></div>
            ) : stats.length === 0 ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-3)' }}>No partner brands registered yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Brand name</th>
                      <th>Prefix</th>
                      <th>Total templates</th>
                      <th>Global card limit</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((entry) => (
                      <tr key={entry.company.id}>
                        <td>
                          <p style={{ fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{entry.company.name}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-4)', margin: 0 }}>
                            Created {new Date(entry.company.created_at).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="mono">{entry.company.prefix}</td>
                        <td className="mono">{entry.issued}</td>
                        <td>
                          {editingId === entry.company.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <input className="input mono" style={{ width: '90px', minHeight: '40px' }} type="number" value={editingLimit} onChange={(event) => setEditingLimit(parseInt(event.target.value, 10) || 1)} min={1} />
                              <button disabled={editLoading} className="btn btn-primary btn-sm" onClick={() => handleUpdateLimit(entry.company.id, entry.company.name)}>
                                Save
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className="mono">{entry.company.coupon_limit}</span>
                              <button className="btn btn-secondary btn-sm" onClick={() => { setEditingId(entry.company.id); setEditingLimit(entry.company.coupon_limit); }}>
                                Edit
                              </button>
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${entry.company.status === 'approved' ? 'badge-green' : entry.company.status === 'pending' ? 'badge-amber' : 'badge-red'}`}>
                            {entry.company.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button disabled={suspendingId === entry.company.id} className="btn btn-secondary btn-sm" onClick={() => handleSuspend(entry.company.id, entry.company.name)}>
                              {suspendingId === entry.company.id ? 'Updating...' : 'Suspend'}
                            </button>
                            <button disabled={deletingId === entry.company.id} className="btn btn-danger btn-sm" onClick={() => handleDelete(entry.company.id, entry.company.name)}>
                              {deletingId === entry.company.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {currentSection === 'offers' && (
        <div className="card fade-in" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Global Market Offers</h3>
            <button className="btn btn-secondary btn-sm" onClick={loadOffers} disabled={offersLoading}>
              {offersLoading ? 'Loading...' : 'Refresh Offers'}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-3)' }}>
                  <th style={{ padding: '1rem', fontWeight: 600 }}>Offer ID</th>
                  <th style={{ padding: '1rem', fontWeight: 600 }}>Merchant</th>
                  <th style={{ padding: '1rem', fontWeight: 600 }}>Campaign Title</th>
                  <th style={{ padding: '1rem', fontWeight: 600 }}>Value / Price</th>
                  <th style={{ padding: '1rem', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {offers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)' }}>
                      No published offers found.
                    </td>
                  </tr>
                ) : (
                  offers.map((offer) => (
                    <tr key={offer.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="mono" style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-3)' }}>{offer.id.split('-')[0]}...</td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{offer.company_name || 'Unknown'}</td>
                      <td style={{ padding: '1rem' }}>{offer.title}</td>
                      <td className="mono" style={{ padding: '1rem', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-3)' }}>Price:</span> ₹{offer.price.toFixed(2)} <br />
                        <span style={{ color: 'var(--text-3)' }}>Value:</span> ₹{offer.value.toFixed(2)}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteOffer(offer.id, offer.title)}
                          disabled={deletingOfferId === offer.id}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                        >
                          {deletingOfferId === offer.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {currentSection === 'users' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <span className="section-label">Registered members</span>
              <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.3rem' }}>Platform users</h3>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input
                className="input"
                style={{ minWidth: '240px' }}
                placeholder="Search by email or ID..."
                value={userSearch}
                onChange={(event) => { setUserSearch(event.target.value); setUsersPage(0); }}
              />
              <button className="btn btn-secondary btn-sm" onClick={loadUsers} disabled={usersLoading}>
                {usersLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {usersLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}><div className="spinner" /></div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-3)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
              <p style={{ margin: 0, fontWeight: 600 }}>{userSearch ? 'No users match your search.' : 'No users found.'}</p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                {userSearch ? 'Try a different email or ID.' : 'Users appear here once they register. Make sure the admin_get_users SQL function is deployed.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Email address</th>
                    <th>Joined</th>
                    <th>Role</th>
                    <th style={{ textAlign: 'right' }}>Security status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-4)' }} title={user.id}>
                        {user.id.split('-')[0]}…
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-1)' }}>{user.email}</td>
                      <td style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>
                        {new Date(user.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <span className={`badge ${user.role === 'admin' ? 'badge-red' : user.role === 'merchant' ? 'badge-cyan' : 'badge-gray'}`}>
                          {user.role?.toUpperCase() ?? 'USER'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => toggleLockAccount(user.id)}
                          className={`btn ${lockedAccounts[user.id] ? 'btn-success' : 'btn-secondary'} btn-sm`}
                        >
                          {lockedAccounts[user.id] ? '🔓 Unlock' : '🔒 Lock'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1rem', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-secondary btn-sm" disabled={usersPage === 0} onClick={() => setUsersPage(p => p - 1)}>
                  ← Previous
                </button>
                <span style={{ color: 'var(--text-3)', fontSize: '0.85rem', fontWeight: 600 }}>
                  Page {usersPage + 1} &nbsp;·&nbsp; Showing {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
                </span>
                <button className="btn btn-secondary btn-sm" disabled={users.length < pageSize} onClick={() => setUsersPage(p => p + 1)}>
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {currentSection === 'ledger' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <input className="input" placeholder="Search by code, brand name, or user email..." value={couponSearch} onChange={(event) => setCouponSearch(event.target.value)} style={{ maxWidth: '380px' }} />
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {(['all', 'active', 'redeemed'] as const).map((filter) => (
                <button key={filter} onClick={() => setCouponFilter(filter)} className={`btn ${couponFilter === filter ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ textTransform: 'capitalize' }}>
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {couponsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}><div className="spinner" /></div>
          ) : filteredCoupons.length === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-3)' }}>No vouchers found matching the current filters.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Voucher code</th>
                    <th>Partner brand</th>
                    <th>Face value</th>
                    <th>Price paid</th>
                    <th>Consumer email</th>
                    <th style={{ textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCoupons.map((coupon) => (
                    <tr key={coupon.coupon_id}>
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--cyan)' }}>{coupon.coupon_code}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-1)' }}>{coupon.company_name}</td>
                      <td className="mono">₹{(coupon.value ?? coupon.remaining_balance).toFixed(2)}</td>
                      <td className="mono">₹{(coupon.price ?? coupon.remaining_balance * 0.9).toFixed(2)}</td>
                      <td style={{ color: 'var(--text-3)' }}>{coupon.user_email || 'anonymous'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`badge ${coupon.is_used ? 'badge-cyan' : 'badge-green'}`}>{coupon.is_used ? 'Redeemed' : 'Active'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1rem', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-secondary btn-sm" disabled={couponsPage === 0} onClick={() => setCouponsPage(p => p - 1)}>
                  Previous
                </button>
                <span style={{ color: 'var(--text-3)', fontSize: '0.85rem', fontWeight: 600 }}>Page {couponsPage + 1}</span>
                <button className="btn btn-secondary btn-sm" disabled={purchasedCoupons.length < pageSize} onClick={() => setCouponsPage(p => p + 1)}>
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {currentSection === 'approvals' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr 180px', padding: '0.875rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', gap: '1rem' }}>
            <span>Merchant partner request</span>
            <span>Tax identifiers</span>
            <span>Attached doc</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {pendingCompanies.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-3)' }}>
              No pending KYC approvals currently in queue.
            </div>
          ) : (
            <div>
              {pendingCompanies.map((company) => (
                <div key={company.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr 180px', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', gap: '1rem' }}>
                  <div>
                    <p style={{ fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{company.name}</p>
                    <p className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-4)', margin: 0 }}>
                      Bank: {company.bank_name || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <p className="mono" style={{ margin: 0, fontSize: '0.8rem' }}>GSTIN: {company.gstin || 'None'}</p>
                    <p className="mono" style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-4)' }}>PAN: {company.pan || 'None'}</p>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setViewingDoc(company.document_url || 'cert_incorporation.pdf')}>
                    {company.document_url || 'Open document'}
                  </button>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button onClick={() => handleApproveMerchant(company.id, company.name)} className="btn btn-success btn-sm">
                      Approve
                    </button>
                    <button onClick={() => handleRejectMerchant(company.id, company.name)} className="btn btn-danger btn-sm">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewingDoc && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,7,18,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
              <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '2rem', textAlign: 'center' }}>
                <span style={{ fontSize: '2rem' }}>DOC</span>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-1)', margin: '0.5rem 0' }}>Document vault preview</h3>
                <p className="mono" style={{ background: 'var(--bg-3)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--cyan)' }}>
                  {viewingDoc}
                </p>
                <button onClick={() => setViewingDoc(null)} className="btn btn-secondary" style={{ marginTop: '1rem', width: '100%' }}>
                  Close preview
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {currentSection === 'security' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1.2fr 1.5fr 100px', padding: '0.875rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', gap: '1rem' }}>
            <span>Time</span>
            <span>Threat event</span>
            <span>Incident detail</span>
            <span style={{ textAlign: 'right' }}>Severity</span>
          </div>

          <div>
            {securityLogs.map((log, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '160px 1.2fr 1.5fr 100px', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', gap: '1rem' }}>
                <span className="mono" style={{ fontSize: '0.75rem' }}>{log.time}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{log.event}</span>
                <span style={{ color: 'var(--text-3)' }}>{log.detail}</span>
                <div style={{ textAlign: 'right' }}>
                  <span className={`badge ${log.severity === 'High' ? 'badge-red' : log.severity === 'Medium' ? 'badge-amber' : 'badge-cyan'}`}>
                    {log.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
