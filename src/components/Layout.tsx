import type { ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Footer from './Footer';

interface LayoutProps {
  children?: ReactNode;
}

export function Layout({ children }: LayoutProps = {}) {
  const { user } = useAuth();
  const location = useLocation();

  const isDashboard =
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/merchant') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/my-coupon');

  const currentPortal =
    location.pathname.startsWith('/admin')
      ? 'admin'
      : location.pathname.startsWith('/merchant')
        ? 'merchant'
        : 'customer';

  if (isDashboard) {
    return (
      <div className="layout-dashboard-root">
        {/* Skip to main content – for keyboard/screen reader users */}
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <div className="layout-dashboard-shell">
          <Sidebar portal={currentPortal as 'customer' | 'merchant' | 'admin'} />

          <div className="layout-dashboard-main">
            <header className="dashboard-surface layout-dashboard-header" role="banner">
              <div className="layout-dashboard-heading">
                <span className="section-label">
                  {currentPortal === 'admin'
                    ? 'Admin Command Center'
                    : currentPortal === 'merchant'
                      ? 'Merchant Workspace'
                      : 'Customer Workspace'}
                </span>
                <div className="layout-dashboard-title-row">
                  <h1 className="layout-dashboard-title">
                    {currentPortal === 'admin'
                      ? 'Platform operations at a glance'
                      : currentPortal === 'merchant'
                        ? 'Launch, track, and redeem campaigns'
                        : 'Discover and manage your gift cards'}
                  </h1>
                  <span className="badge badge-purple" aria-label={`Logged in as ${user?.email ?? 'active session'}`}>
                    {user?.email ? user.email.split('@')[0] : 'active session'}
                  </span>
                </div>
              </div>

              <div className="layout-dashboard-actions">
                <span className="badge badge-purple" aria-hidden="true">
                  {currentPortal === 'admin'
                    ? 'Admin area'
                    : currentPortal === 'merchant'
                      ? 'Company area'
                      : 'Customer area'}
                </span>
              </div>
            </header>

            <main id="main-content" className="dashboard-surface fade-in layout-dashboard-content" role="main">
              {children ?? <Outlet />}
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="layout-root">
      {/* Skip to main content – for keyboard/screen reader users */}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="layout-public-header" role="banner">
        <div className="app-shell layout-public-shell">
          <Link to="/" className="layout-brand">
            <div className="layout-brand-mark" aria-hidden="true">C</div>
            <div className="layout-brand-copy">
              <strong className="layout-brand-title">CouponVault</strong>
              <span className="layout-brand-subtitle">Premium digital gifting</span>
            </div>
          </Link>



          <div className="layout-public-actions">
            <Link className="btn btn-secondary btn-sm" to="/userlogin">
              Customer login
            </Link>
            <Link className="btn btn-primary btn-sm" to="/companylogin">
              Company login
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="app-shell layout-public-main" role="main">{children ?? <Outlet />}</main>

      <Footer />
    </div>
  );
}

export default Layout;
