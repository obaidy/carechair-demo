import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container page-stack">
      <section className="hero-card">
        <h1>Page not found</h1>
        <p>The page you requested does not exist.</p>
        <Link href="/" className="btn btn-primary">Home</Link>
      </section>
    </div>
  );
}
