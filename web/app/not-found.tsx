import {Link} from '@/i18n/navigation';

export default function NotFound() {
  return (
    <div className="platform-page">
      <main className="platform-main">
        <section className="panel hero-lite">
          <h1>Page not found</h1>
          <p>The page you requested does not exist.</p>
          <Link href="/" className="btn btn-primary">Home</Link>
        </section>
      </main>
    </div>
  );
}
