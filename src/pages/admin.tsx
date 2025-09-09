import { useState } from 'react';
import Head from 'next/head';

export default function AdminPage() {
  const [path, setPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [itemId, setItemId] = useState('');
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageMessage, setPageMessage] = useState('');
  const [pageData, setPageData] = useState(null);

  const handleRevalidate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!path) {
      setMessage('Please enter a path to revalidate');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/revalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(`Successfully revalidated: ${path}`);
        setPath('');
      } else {
        setMessage(`Error: ${result.error || 'Failed to revalidate'}`);
      }
    } catch (error) {
      setMessage('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetPage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemId) {
      setPageMessage('Please enter an item ID or path');
      return;
    }

    setIsLoadingPage(true);
    setPageMessage('');
    setPageData(null);

    try {
      const response = await fetch('/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: itemId }),
      });

      const result = await response.json();

      if (response.ok) {
        setPageData(result);
        setPageMessage('Successfully fetched page data');
      } else {
        setPageMessage(`Error: ${result.message || 'Failed to fetch page data'}`);
      }
    } catch (error) {
      setPageMessage('Network error occurred');
    } finally {
      setIsLoadingPage(false);
    }
  };

  return (
    <>
      <Head>
        <title>Admin - Revalidate Pages</title>
      </Head>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
        <h1>Admin Panel</h1>
        <h2>Revalidate Pages</h2>

        <form onSubmit={handleRevalidate} style={{ marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="path" style={{ display: 'block', marginBottom: '0.5rem' }}>
              Path to revalidate:
            </label>
            <input
              type="text"
              id="path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/example-page"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? '#ccc' : '#0070f3',
              color: 'white',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Revalidating...' : 'Revalidate'}
          </button>
        </form>

        {message && (
          <div
            style={{
              padding: '1rem',
              border: '1px solid',
              borderRadius: '4px',
              borderColor: message.includes('Error') ? '#ff0000' : '#00aa00',
              backgroundColor: message.includes('Error') ? '#ffe6e6' : '#e6ffe6',
              color: message.includes('Error') ? '#cc0000' : '#006600',
            }}
          >
            {message}
          </div>
        )}

        <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid #ccc' }} />

        <h2>Query Sitecore Page</h2>

        <form onSubmit={handleGetPage} style={{ marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="itemId" style={{ display: 'block', marginBottom: '0.5rem' }}>
              Item ID or Path:
            </label>
            <input
              type="text"
              id="itemId"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              placeholder="{11111111-1111-1111-1111-111111111111} or /path/to/item"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoadingPage}
            style={{
              backgroundColor: isLoadingPage ? '#ccc' : '#28a745',
              color: 'white',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: isLoadingPage ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoadingPage ? 'Fetching...' : 'Get Page Data'}
          </button>
        </form>

        {pageMessage && (
          <div
            style={{
              padding: '1rem',
              border: '1px solid',
              borderRadius: '4px',
              borderColor: pageMessage.includes('Error') ? '#ff0000' : '#00aa00',
              backgroundColor: pageMessage.includes('Error') ? '#ffe6e6' : '#e6ffe6',
              color: pageMessage.includes('Error') ? '#cc0000' : '#006600',
              marginBottom: '1rem',
            }}
          >
            {pageMessage}
          </div>
        )}

        {pageData && (
          <div
            style={{
              padding: '1rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: '#f8f9fa',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
              overflow: 'auto',
              maxHeight: '400px',
            }}
          >
            {JSON.stringify(pageData, null, 2)}
          </div>
        )}
      </div>
    </>
  );
}
