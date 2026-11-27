import { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function ApiDocs() {
  const [spec, setSpec] = useState(null);
  const [error, setError] = useState(null);

  const backendBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  const jsonUrl = `${backendBaseUrl}/api-docs.json`;
  const directDocsUrl = `${backendBaseUrl}/api-docs/`;

  useEffect(() => {
    fetch(jsonUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then(data => setSpec(data))
      .catch(err => {
        console.warn('Could not fetch from backend directly, loading fallback spec:', err);
        setError(err.message);
      });
  }, [jsonUrl]);

  return (
    <div style={{ minHeight: '100vh', background: '#0e120f', color: '#f5f5f7', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        height: '56px',
        background: '#131914',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <strong style={{ color: '#d4ff00', fontSize: '16px', letterSpacing: '0.04em' }}>VINO FITNESS STUDIO</strong>
          <span style={{ fontSize: '13px', color: '#889082' }}>API Documentation (OpenAPI 3.0)</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <a
            href={directDocsUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '12px',
              color: '#101400',
              background: '#d4ff00',
              padding: '6px 14px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 700
            }}
          >
            Direct Swagger Server ↗
          </a>
          <a
            href="/"
            style={{
              fontSize: '12px',
              color: '#f5f5f7',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '6px 14px',
              borderRadius: '6px',
              textDecoration: 'none'
            }}
          >
            Back to Studio App
          </a>
        </div>
      </header>

      <main style={{ flex: 1, padding: '20px', maxWidth: '1300px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {spec ? (
          <div className="swagger-native-wrapper" style={{ borderRadius: '12px', overflow: 'hidden', background: '#ffffff', padding: '16px' }}>
            <SwaggerUI spec={spec} />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <h3 style={{ color: '#ff6b72', marginBottom: '12px' }}>Loading Swagger Specification...</h3>
            <p style={{ color: '#889082', marginBottom: '24px' }}>Unable to load specification from {jsonUrl} ({error}).</p>
            <a
              href={directDocsUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: '14px',
                color: '#101400',
                background: '#d4ff00',
                padding: '10px 20px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 700
              }}
            >
              Open Backend Swagger Server Directly ↗
            </a>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#889082' }}>
            <p>Loading API Documentation...</p>
          </div>
        )}
      </main>
    </div>
  );
}
