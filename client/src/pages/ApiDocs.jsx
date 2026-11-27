import { useEffect } from 'react';

export default function ApiDocs() {
  const backendBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  const docsUrl = `${backendBaseUrl}/api-docs/`;

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, background: '#0a0d0b', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        height: '52px',
        background: '#111612',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        color: '#f5f5f7',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <strong style={{ color: '#d4ff00', fontSize: '15px', letterSpacing: '0.05em' }}>VINO FITNESS STUDIO</strong>
          <span style={{ fontSize: '12px', color: '#889082' }}>REST API Documentation</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '12px',
              color: '#101400',
              background: '#d4ff00',
              padding: '6px 14px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 600
            }}
          >
            Open in new tab ↗
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
            Back to App
          </a>
        </div>
      </header>
      <iframe
        src={docsUrl}
        title="Swagger API Documentation"
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          background: '#ffffff'
        }}
      />
    </div>
  );
}
