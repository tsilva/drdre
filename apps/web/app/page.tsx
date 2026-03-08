import { SearchShell } from "../components/search-shell";

export default function HomePage() {
  return (
    <main>
      <section className="masthead">
        <div>
          <p className="kicker">Portugal / Diário da República / Search</p>
          <h1>Semantic retrieval for modern and historical law.</h1>
          <p>
            Hybrid retrieval over a hot semantic window and a full historical metadata catalog, tuned for free-tier
            hosting.
          </p>
        </div>
        <div className="stats-grid">
          <article className="stat-card">
            <span className="stat-label">Semantic window</span>
            <span className="stat-value">24 months</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">Cold storage</span>
            <span className="stat-value">R2 shards</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">Catalog search</span>
            <span className="stat-value">D1 + FTS5</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">Frontend</span>
            <span className="stat-value">Vercel</span>
          </article>
        </div>
      </section>

      <SearchShell />
    </main>
  );
}
