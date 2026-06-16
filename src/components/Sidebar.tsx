import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingBag, Wallet, Activity, CreditCard, LayoutDashboard,
  Users, BookOpen, CheckCircle, UserPlus, Shield, LogOut,
  Sparkles, Layers, BarChart3, Store, Scan,
  Zap
} from 'lucide-react';

interface SidebarProps {
  portal: 'customer' | 'merchant' | 'admin';
}

interface NavLink { label: string; path: string; Icon: React.ComponentType<{ size?: number }> }

const customerLinks: NavLink[] = [
  { label: 'Marketplace', path: '/dashboard/marketplace', Icon: ShoppingBag },
  { label: 'Wallet',      path: '/dashboard/wallet',      Icon: Wallet },
  { label: 'Activity',    path: '/dashboard/activity',    Icon: Activity },
  { label: 'My Cards',   path: '/dashboard/cards',        Icon: CreditCard },
];

const merchantLinks: NavLink[] = [
  { label: 'Overview',    path: '/merchant/overview',     Icon: LayoutDashboard },
  { label: 'Campaigns',   path: '/merchant/campaigns',    Icon: Zap },
  { label: 'Coupons',     path: '/merchant/coupons',      Icon: Layers },
  { label: 'Redemptions', path: '/merchant/redemptions',  Icon: Scan },
  { label: 'Onboarding',  path: '/merchant/onboarding',   Icon: UserPlus },
];

const adminLinks: NavLink[] = [
  { label: 'Overview',    path: '/admin/overview',        Icon: BarChart3 },
  { label: 'Partners',    path: '/admin/partners',        Icon: Store },
  { label: 'Users',       path: '/admin/users',           Icon: Users },
  { label: 'Ledger',      path: '/admin/ledger',          Icon: BookOpen },
  { label: 'Approvals',   path: '/admin/approvals',       Icon: CheckCircle },
  { label: 'Security',    path: '/admin/security',        Icon: Shield },
];

/* Portal-specific design tokens */
const portalTheme = {
  customer: {
    gradient: 'linear-gradient(135deg, #7c8ef8, #4f63f5)',
    glow: 'rgba(79, 99, 245, 0.30)',
    activeBg: 'rgba(79, 99, 245, 0.10)',
    activeBorder: 'rgba(79, 99, 245, 0.22)',
    activeColor: '#3648e8',
    label: 'Customer Portal',
    accentColor: '#4f63f5',
  },
  merchant: {
    gradient: 'linear-gradient(135deg, #34d399, #059669)',
    glow: 'rgba(5, 150, 105, 0.30)',
    activeBg: 'rgba(5, 150, 105, 0.10)',
    activeBorder: 'rgba(5, 150, 105, 0.22)',
    activeColor: '#047857',
    label: 'Merchant Portal',
    accentColor: '#059669',
  },
  admin: {
    gradient: 'linear-gradient(135deg, #94a3b8, #475569)',
    glow: 'rgba(71, 85, 105, 0.30)',
    activeBg: 'rgba(71, 85, 105, 0.10)',
    activeBorder: 'rgba(71, 85, 105, 0.22)',
    activeColor: '#334155',
    label: 'Admin Portal',
    accentColor: '#475569',
  },
};

export default function Sidebar({ portal }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const links = portal === 'admin' ? adminLinks : portal === 'merchant' ? merchantLinks : customerLinks;
  const theme = portalTheme[portal];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <aside
      className="sidebar sidebar-glass"
    >
      {/* Brand */}
      <Link to="/" className="sidebar-brand">
        <div
          className="sidebar-brand-mark"
          style={{ background: theme.gradient, boxShadow: `0 6px 18px ${theme.glow}` }}
        >
          <Sparkles size={20} />
        </div>
        <div>
          <div className="sidebar-brand-title">CouponVault</div>
          <div className="sidebar-brand-subtitle">{theme.label}</div>
        </div>
      </Link>

      {/* Account pill */}
      <div
        className="sidebar-account"
      >
        <div className="section-label" style={{ marginBottom: '0.35rem', fontSize: '0.64rem' }}>
          Active session
        </div>
        <div
          className="sidebar-account-value"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}
        >
          <span
            className="glow-dot"
            style={{ width: 7, height: 7, background: theme.accentColor, boxShadow: `0 0 6px ${theme.glow}` }}
          />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
            {user?.email ?? 'Guest session'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" style={{ flex: 1 }}>
        {links.map((link, index) => {
          const isActive = index === 0
            ? location.pathname === link.path
            : location.pathname.startsWith(link.path);

          return (
            <Link
              key={`${link.label}-${index}`}
              to={link.path}
              className={`sidebar-link${isActive ? ' is-active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.7rem',
                ...(isActive
                  ? {
                      background: theme.activeBg,
                      borderColor: theme.activeBorder,
                      color: theme.activeColor,
                      fontWeight: 650,
                    }
                  : {}),
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isActive ? theme.activeBg : 'var(--surface-muted)',
                  color: isActive ? theme.activeColor : 'var(--text-3)',
                  flexShrink: 0,
                  transition: 'background 160ms ease, color 160ms ease',
                }}
              >
                <link.Icon size={15} />
              </span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign-out button */}
      <button
        className="btn btn-secondary btn-sm sidebar-signout"
        onClick={handleSignOut}
      >
        <LogOut size={14} />
        Sign out
      </button>
    </aside>
  );
}
