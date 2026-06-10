import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  portal: 'customer' | 'merchant' | 'admin';
}

export default function Sidebar({ portal }: SidebarProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();

  const links =
    portal === 'admin'
      ? [
          { label: 'Overview', path: '/admin/overview' },
          { label: 'Partners', path: '/admin/partners' },
          { label: 'Users', path: '/admin/users' },
          { label: 'Ledger', path: '/admin/ledger' },
          { label: 'Approvals', path: '/admin/approvals' },
          { label: 'Security', path: '/admin/security' },
        ]
      : portal === 'merchant'
        ? [
            { label: 'Overview', path: '/merchant/overview' },
            { label: 'Campaigns', path: '/merchant/campaigns' },
            { label: 'Coupons', path: '/merchant/coupons' },
            { label: 'Redemptions', path: '/merchant/redemptions' },
            { label: 'Onboarding', path: '/merchant/onboarding' },
          ]
        : [
            { label: 'Marketplace', path: '/dashboard/marketplace' },
            { label: 'Wallet', path: '/dashboard/wallet' },
            { label: 'Activity', path: '/dashboard/activity' },
            { label: 'My Cards', path: '/dashboard/cards' },
          ];

  const portalLabel =
    portal === 'admin' ? 'Admin Portal' : portal === 'merchant' ? 'Merchant Portal' : 'Customer Portal';

  return (
    <aside className="glass-card sidebar">
      <Link to="/" className="sidebar-brand">
        <div className="sidebar-brand-mark">C</div>
        <div>
          <div className="sidebar-brand-title">CouponVault</div>
          <div className="sidebar-brand-subtitle">{portalLabel}</div>
        </div>
      </Link>

      <div className="card sidebar-account">
        <div className="section-label" style={{ marginBottom: '0.5rem' }}>
          Active account
        </div>
        <div className="sidebar-account-value">{user?.email ?? 'Guest session'}</div>
      </div>

      <nav className="sidebar-nav">
        {links.map((link, index) => {
          const isActive = index === 0
            ? location.pathname === link.path
            : location.pathname.startsWith(link.path);

          return (
            <Link
              key={`${link.label}-${index}`}
              to={link.path}
              className={`sidebar-link${isActive ? ' is-active' : ''}`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <button className="btn btn-secondary btn-sm sidebar-signout" onClick={() => signOut()}>
        Sign out
      </button>
    </aside>
  );
}
