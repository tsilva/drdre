import Link from "next/link";

interface DocumentPageProps {
  params: Promise<{
    id: string;
  }>;
}

async function fetchDocument(id: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SEARCH_API_BASE_URL;
  if (!baseUrl) {
    return null;
  }

  const response = await fetch(`${baseUrl}/api/document/${id}`, {
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as {
    document_id: string;
    title: string;
    citation: string;
    publication_date: string;
    official_url: string;
    body_text: string;
    storage_status: string;
  };
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id } = await params;
  const document = await fetchDocument(id);

  return (
    <main>
      <div className="detail-card">
        <p className="kicker">Document detail</p>
        {!document ? (
          <>
            <h1>Document unavailable</h1>
            <p className="error-state">
              The Worker API is not configured yet or the document was not found in D1/R2.
            </p>
          </>
        ) : (
          <>
            <h1>{document.title}</h1>
            <div className="detail-meta">
              <span>{document.citation}</span>
              <span>{document.publication_date}</span>
              <span>Storage: {document.storage_status}</span>
            </div>
            <p>
              <a className="detail-link" href={document.official_url} target="_blank" rel="noreferrer">
                Open canonical DR page
              </a>
            </p>
            <div className="detail-body">{document.body_text || "No body text is currently available in R2."}</div>
          </>
        )}
        <p>
          <Link className="detail-link" href="/">
            Back to search
          </Link>
        </p>
      </div>
    </main>
  );
}
