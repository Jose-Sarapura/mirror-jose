'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(event) {
    event?.preventDefault();

    if (!user.trim() || !password) {
      setError('Ingresa tu usuario y contraseña.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: user.trim(),
          password,
        }),
      });

      if (!response.ok) {
        setError('Usuario o contraseña incorrectos.');
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('No fue posible iniciar sesión. Inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at top left, rgba(34,197,94,0.18), transparent 34%), radial-gradient(circle at bottom right, rgba(59,130,246,0.18), transparent 38%), linear-gradient(135deg, #070b12 0%, #0d1320 50%, #111827 100%)',
        color: '#f8fafc',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'rgba(34, 197, 94, 0.08)',
          filter: 'blur(80px)',
          top: '-120px',
          left: '-120px',
        }}
      />

      <div
        style={{
          position: 'absolute',
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.08)',
          filter: 'blur(80px)',
          right: '-130px',
          bottom: '-140px',
        }}
      />

      <section
        style={{
          width: '100%',
          maxWidth: 1040,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(360px, 0.9fr)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 28,
          overflow: 'hidden',
          background: 'rgba(11, 15, 23, 0.78)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(18px)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            minHeight: 580,
            padding: '56px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background:
              'linear-gradient(160deg, rgba(34,197,94,0.12), rgba(15,23,42,0.2) 55%, rgba(59,130,246,0.08))',
            borderRight: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: 22,
                color: '#04120a',
                background: 'linear-gradient(135deg, #4ade80, #22c55e)',
                boxShadow: '0 12px 30px rgba(34,197,94,0.25)',
                marginBottom: 32,
              }}
            >
              M
            </div>

            <p
              style={{
                margin: 0,
                color: '#86efac',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
              }}
            >
              Panel patrimonial
            </p>

            <h1
              style={{
                margin: '14px 0 18px',
                fontSize: 'clamp(38px, 5vw, 64px)',
                lineHeight: 1,
                letterSpacing: '-0.045em',
              }}
            >
              Mirror José
            </h1>

            <p
              style={{
                maxWidth: 520,
                margin: 0,
                color: '#a8b3c7',
                fontSize: 18,
                lineHeight: 1.7,
              }}
            >
              Visualiza tu patrimonio, controla tu portafolio y sigue el avance
              hacia tu libertad financiera desde un solo lugar.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginTop: 48,
            }}
          >
            {[
              ['Portafolio', 'Siempre visible'],
              ['Meta', '$600.000.000'],
              ['Seguridad', 'Acceso privado'],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.045)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <small
                  style={{
                    display: 'block',
                    color: '#718096',
                    marginBottom: 7,
                  }}
                >
                  {label}
                </small>

                <strong style={{ fontSize: 14 }}>{value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            padding: '48px 42px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <form onSubmit={handleLogin} style={{ width: '100%' }}>
            <p
              style={{
                color: '#86efac',
                fontWeight: 700,
                fontSize: 13,
                margin: 0,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              Acceso seguro
            </p>

            <h2
              style={{
                margin: '10px 0 8px',
                fontSize: 32,
                letterSpacing: '-0.03em',
              }}
            >
              Bienvenido de vuelta
            </h2>

            <p
              style={{
                margin: '0 0 30px',
                color: '#8f9bb0',
                lineHeight: 1.6,
              }}
            >
              Ingresa tus credenciales para acceder a Mirror José.
            </p>

            <label
              htmlFor="user"
              style={{
                display: 'block',
                color: '#cbd5e1',
                fontSize: 14,
                marginBottom: 9,
              }}
            >
              Usuario
            </label>

            <input
              id="user"
              value={user}
              onChange={(event) => setUser(event.target.value)}
              autoComplete="username"
              placeholder="Ingresa tu usuario"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '15px 16px',
                marginBottom: 20,
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.045)',
                color: '#f8fafc',
                outline: 'none',
                fontSize: 15,
              }}
            />

            <label
              htmlFor="password"
              style={{
                display: 'block',
                color: '#cbd5e1',
                fontSize: 14,
                marginBottom: 9,
              }}
            >
              Contraseña
            </label>

            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '15px 96px 15px 16px',
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.045)',
                  color: '#f8fafc',
                  outline: 'none',
                  fontSize: 15,
                }}
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 0,
                  borderRadius: 10,
                  padding: '8px 10px',
                  background: 'transparent',
                  color: '#86efac',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>

            {error && (
              <div
                style={{
                  marginTop: 18,
                  padding: '12px 14px',
                  borderRadius: 12,
                  color: '#fecaca',
                  background: 'rgba(239,68,68,0.10)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                marginTop: 24,
                padding: '15px 18px',
                border: 0,
                borderRadius: 14,
                background: loading
                  ? '#14532d'
                  : 'linear-gradient(135deg, #4ade80, #22c55e)',
                color: '#04120a',
                fontSize: 15,
                fontWeight: 800,
                cursor: loading ? 'wait' : 'pointer',
                boxShadow: '0 14px 34px rgba(34,197,94,0.22)',
              }}
            >
              {loading ? 'Ingresando…' : 'Ingresar a Mirror José'}
            </button>

            <p
              style={{
                textAlign: 'center',
                margin: '22px 0 0',
                color: '#64748b',
                fontSize: 12,
              }}
            >
              Acceso privado y protegido.
            </p>
          </form>
        </div>
      </section>

      <style jsx>{`
        @media (max-width: 860px) {
          section {
            grid-template-columns: 1fr !important;
          }

          section > div:first-child {
            min-height: auto !important;
            padding: 34px !important;
            border-right: 0 !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          }

          section > div:last-child {
            padding: 34px !important;
          }
        }

        @media (max-width: 560px) {
          main {
            padding: 14px !important;
          }

          section {
            border-radius: 22px !important;
          }

          section > div:first-child {
            padding: 28px 22px !important;
          }

          section > div:last-child {
            padding: 30px 22px !important;
          }
        }
      `}</style>
    </main>
  );
}