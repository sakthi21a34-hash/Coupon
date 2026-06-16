import type { ReactNode } from 'react';
import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';
import Sidebar from './Sidebar';
import Footer from './Footer';

interface LayoutProps {
  children?: ReactNode;
}

export function Layout({ children }: LayoutProps = {}) {
  const { user } = useAuth();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

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
    const portalBadgeClass =
      currentPortal === 'admin'
        ? 'badge badge-admin'
        : currentPortal === 'merchant'
          ? 'badge badge-merchant'
          : 'badge badge-customer';

    const portalDotColor =
      currentPortal === 'admin' ? '#475569' : currentPortal === 'merchant' ? '#059669' : '#4f63f5';

    return (
      <div className="layout-dashboard-root aurora-bg">
        {/* Aurora decorative orbs */}
        <div className="aurora-orb aurora-orb--1" />
        <div className="aurora-orb aurora-orb--2" />
        {/* Skip to main content – for keyboard/screen reader users */}
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <div className="layout-dashboard-shell" style={{ position: 'relative', zIndex: 1 }}>
          <Sidebar portal={currentPortal as 'customer' | 'merchant' | 'admin'} />

          <div className="layout-dashboard-main">
            <header className="dashboard-header-glass layout-dashboard-header" role="banner">
              <div className="layout-dashboard-heading">
                <div className="layout-dashboard-title-row">
                  <h1 className="layout-dashboard-title">
                    {currentPortal === 'admin'
                      ? 'Platform Operations'
                      : currentPortal === 'merchant'
                        ? 'Merchant Workspace'
                        : 'Your Gift Card Hub'}
                  </h1>
                  <span
                    className={portalBadgeClass}
                    aria-label={`Logged in as ${user?.email ?? 'active session'}`}
                  >
                    <span
                      style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: portalDotColor,
                        display: 'inline-block', marginRight: '0.3rem',
                      }}
                    />
                    {user?.email ? user.email.split('@')[0] : 'session'}
                  </span>
                </div>
                <span className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                  {currentPortal === 'admin'
                    ? 'Admin command center • Approvals, controls and audit'
                    : currentPortal === 'merchant'
                      ? 'Launch, track and redeem campaigns'
                      : '✨ Discover, purchase and manage your gift cards'}
                </span>
              </div>

              <div className="layout-dashboard-actions">
                <button
                  className="theme-toggle"
                  onClick={toggleTheme}
                  aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                  title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                  {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                </button>
                <span
                  className={portalBadgeClass}
                  aria-hidden="true"
                  style={{ backdropFilter: 'blur(8px)', fontWeight: 700 }}
                >
                  {currentPortal === 'admin' ? 'Admin' : currentPortal === 'merchant' ? 'Merchant' : 'Customer'}
                </span>
              </div>
            </header>

            <main id="main-content" className="dashboard-content-glass fade-in layout-dashboard-content" role="main">
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
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
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
