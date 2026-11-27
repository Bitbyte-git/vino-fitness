import { useEffect, useRef, useState } from 'react';

export default function ApiDocs() {
  const containerRef = useRef(null);

  const backendBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  const jsonUrl = `${backendBaseUrl}/api-docs.json`;
  const directDocsUrl = `${backendBaseUrl}/api-docs/`;

  useEffect(() => {
    let unmounted = false;

    // 1. Ensure CSS link exists in head without duplicate appending
    let link = document.querySelector('link[data-swagger-css]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css';
      link.setAttribute('data-swagger-css', 'true');
      document.head.appendChild(link);
    }

    const initSwagger = () => {
      if (unmounted || !window.SwaggerUIBundle || !containerRef.current) return;
      // Isolate external DOM mutations inside an unmanaged inner wrapper
      containerRef.current.innerHTML = '';
      const targetDiv = document.createElement('div');
      containerRef.current.appendChild(targetDiv);

      window.SwaggerUIBundle({
        url: jsonUrl,
        domNode: targetDiv,
        deepLinking: true,
        presets: [window.SwaggerUIBundle.presets.apis],
      });
    };

    if (window.SwaggerUIBundle) {
      initSwagger();
    } else {
      let script = document.querySelector('script[data-swagger-js]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js';
        script.crossOrigin = 'anonymous';
        script.setAttribute('data-swagger-js', 'true');
        script.onload = () => initSwagger();
        document.body.appendChild(script);
      } else {
        script.addEventListener('load', initSwagger, { once: true });
      }
    }

    return () => {
      unmounted = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
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

      <main style={{ flex: 1, padding: '24px 20px', maxWidth: '1300px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <div
          ref={containerRef}
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            overflow: 'hidden',
            padding: '16px',
            minHeight: '600px'
          }}
        />
      </main>
    </div>
  );
}
