import { Link } from 'react-router-dom';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-section" role="contentinfo">
      <div className="app-shell footer-shell">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-brand-mark">C</div>
            <div>
              <h3 className="footer-brand-title">CouponVault</h3>
              <p className="footer-brand-subtitle">Premium digital gifting made simple</p>
            </div>
          </div>

          <div className="footer-social">
            <a href="https://twitter.com" aria-label="Twitter" className="footer-social-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 7-7 7-7a4.48 4.48 0 01-1.3-3c0-1.5 1-3 3-3"/>
              </svg>
            </a>
            <a href="https://linkedin.com" aria-label="LinkedIn" className="footer-social-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
            </a>
            <a href="https://facebook.com" aria-label="Facebook" className="footer-social-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h-3a6 6 0 00-6 6v3H7v4h2v8h4v-8h3l1-4h-4V8a1 1 0 011-1h3z"/>
              </svg>
            </a>
            <a href="https://instagram.com" aria-label="Instagram" className="footer-social-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/>
                <circle cx="17.5" cy="6.5" r="1.5"/>
              </svg>
            </a>
          </div>
        </div>

        <div className="footer-columns">
          <div className="footer-column">
            <h4 className="footer-column-title">Product</h4>
            <ul className="footer-links">
              <li><Link to="/" className="footer-link">Marketplace</Link></li>
              <li><a href="#features" className="footer-link">Features</a></li>
              <li><a href="#pricing" className="footer-link">Pricing</a></li>
              <li><a href="#merchants" className="footer-link">For Merchants</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4 className="footer-column-title">Company</h4>
            <ul className="footer-links">
              <li><a href="#about" className="footer-link">About us</a></li>
              <li><a href="#blog" className="footer-link">Blog</a></li>
              <li><a href="#careers" className="footer-link">Careers</a></li>
              <li><a href="#press" className="footer-link">Press kit</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4 className="footer-column-title">Resources</h4>
            <ul className="footer-links">
              <li><a href="#help" className="footer-link">Help center</a></li>
              <li><a href="#docs" className="footer-link">Documentation</a></li>
              <li><a href="#api" className="footer-link">API reference</a></li>
              <li><a href="#status" className="footer-link">Status page</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h4 className="footer-column-title">Legal</h4>
            <ul className="footer-links">
              <li><a href="#privacy" className="footer-link">Privacy policy</a></li>
              <li><a href="#terms" className="footer-link">Terms of service</a></li>
              <li><a href="#cookies" className="footer-link">Cookie policy</a></li>
              <li><a href="#contact" className="footer-link">Contact us</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="footer-divider"></div>

      <div className="app-shell footer-bottom">
        <p className="footer-copyright">
          © {currentYear} CouponVault. All rights reserved.
        </p>
        <div className="footer-badges">
          <span className="badge badge-purple">ISO 27001</span>
          <span className="badge badge-green">PCI Compliant</span>
          <span className="badge badge-blue">SOC 2 Type II</span>
        </div>
      </div>
    </footer>
  );
}
