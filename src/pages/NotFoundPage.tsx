import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-1)' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '4rem', fontWeight: 800, margin: '0 0 1rem', color: 'var(--primary)' }}>404</h1>
        <h2 style={{ fontSize: '1.5rem', margin: '0 0 2rem', color: 'var(--text-1)' }}>Page Not Found</h2>
        <p style={{ color: 'var(--text-3)', marginBottom: '2rem' }}>The page you are looking for doesn't exist or has been moved.</p>
        <Link to="/" className="btn btn-primary">Return Home</Link>
      </div>
    </div>
  );
}
