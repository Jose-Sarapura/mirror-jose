'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const TARGETS = {
  VOO: 60,
  SMH: 20,
  BCH: 5,
  CFIETFGE: 15,
};

const clp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('inicio');
  const [aporte, setAporte] = useState(200000);
  const [history, setHistory] = useState([]);
  const [racionalTotal, setRacionalTotal] = useState(9221648);
  const [capitalInvertido, setCapitalInvertido] = useState(7800000);
  const [aporteMensual, setAporteMensual] = useState(200000);
  const [rentabilidadAnual, setRentabilidadAnual] = useState(10);
  
  const metaPatrimonial = 600000000;
  async function load() {
    try {
      setError('');

      const response = await fetch('/api/portfolio', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('No fue posible actualizar');
      }

      setData(await response.json());
    } catch (err) {
      setError(err.message);
    }
  }

useEffect(() => {
  load();

  const timer = setInterval(load, 5 * 60 * 1000);

  return () => clearInterval(timer);
}, []);

useEffect(() => {
  if (!data) return;

  const saved = JSON.parse(
    localStorage.getItem('mirrorHistory') || '[]'
  );

  const today = new Date().toISOString().slice(0, 10);

  const updated = [
    ...saved.filter(item => item.date !== today),
    {
      date: today,
      totalCLP: Math.round(data.totalCLP),
    },
  ].sort((a, b) => a.date.localeCompare(b.date));

  localStorage.setItem(
    'mirrorHistory',
    JSON.stringify(updated)
  );

  setHistory(updated);
}, [data]);

  const recommendation = useMemo(() => {
    if (!data) return null;

    return data.assets
      .map((asset) => ({
        ticker: asset.ticker,
        gap: TARGETS[asset.ticker] - asset.weight,
      }))
      .sort((a, b) => b.gap - a.gap)[0];
  }, [data]);
  const contributionPlan = useMemo(() => {
  if (!data || !aporte) return [];
  
 const deficits = data.assets
      .map((asset) => ({
        ticker: asset.ticker,
        deficit: Math.max(
          0,
          TARGETS[asset.ticker] - asset.weight,
        ),
      }))
      .filter((asset) => asset.deficit > 0);

    const totalDeficit = deficits.reduce(
      (sum, asset) => sum + asset.deficit,
      0,
    );

    if (totalDeficit === 0) return [];

    return deficits.map((asset) => ({
      ticker: asset.ticker,
      amount: Math.round(
        aporte * (asset.deficit / totalDeficit),
      ),
    }));
  }, [data, aporte]);
const chartData = useMemo(
  () =>
    history.map((item) => ({
      date: item.date,
      totalCLP: Number(item.totalCLP),
    })),
  [history]
);
  const healthScore = useMemo(() => {
    if (!data) return 0;

    const totalDeviation = data.assets.reduce((sum, asset) => {
      return sum + Math.abs(asset.weight - TARGETS[asset.ticker]);
    }, 0);

    return Math.max(0, Math.round(100 - totalDeviation * 2));
  }, [data]);

  const goalProgress = data
    ? Math.min(100, (data.totalCLP / 600000000) * 100)
    : 0;

  if (!data) {
    return (
      <main className="loadingScreen">
        <div className="loader" />
        <p>Cargando Mirror José...</p>
      </main>
    );
  }

  return (
    <div className="appShell">
      <header className="topHeader">
        <div>
          <p className="eyebrow">Panel patrimonial</p>
          <h1>Mirror José</h1>
        </div>

        <div className="syncStatus">
          <span className="statusDot" />
          <div>
            <strong>Actualizado</strong>
            <small>
              {new Date(data.updatedAt).toLocaleString('es-CL')}
            </small>
          </div>
        </div>
      </header>

      <main className="dashboard">
        {error && (
          <div className="alert">
            {error}. Se muestran los últimos valores disponibles.
          </div>
        )}

        {tab === 'inicio' && (
          <>
            <section className="heroCard">
              <div className="heroContent">
           <p className="eyebrow">Patrimonio total</p>

                <h2>{clp.format(data.totalCLP)}</h2>
                <div className="comparisonBox">
                  <div className="returnBox">
  <span>Rentabilidad total</span>

  <strong>
    {clp.format(
      Math.round(data.totalCLP) - capitalInvertido
    )}
  </strong>

  <small>
    {(
      ((data.totalCLP - capitalInvertido) /
        capitalInvertido) *
      100
    ).toFixed(2)}
    %
  </small>
</div>
  <div>
    <span>Racional</span>
    <strong>{clp.format(racionalTotal)}</strong>
  </div>

  <div>
    <span>Mirror</span>
    <strong>{clp.format(Math.round(data.totalCLP))}</strong>
  </div>

  <div>
    <span>Diferencia</span>
    <strong>
      {clp.format(
        Math.round(data.totalCLP) - racionalTotal
      )}
    </strong>
  </div>
</div>

                <div className="heroMeta">
                  <span>
  Patrimonio actualizado automáticamente desde Racional.
</span>

<button type="button" onClick={load}>
  Actualizar
</button>
</div>
</div>

              <div className="heroGlow" />
            </section>

            <section className="summaryGrid">
              <article className="summaryCard">
                <div>
                  <p>Meta patrimonial</p>
                  <strong>{clp.format(600000000)}</strong>
                </div>

                <span>{goalProgress.toFixed(2)}%</span>

                <div className="progressTrack">
                  <div
                    className="progressFill"
                    style={{ width: `${goalProgress}%` }}
                  />
                </div>
              </article>

              <article className="summaryCard">
                <div>
                  <p>Salud de la cartera</p>
                  <strong>{healthScore}/100</strong>
                </div>

                <span>
                  {healthScore >= 85
                    ? 'Excelente'
                    : healthScore >= 70
                      ? 'Buena'
                      : 'Requiere atención'}
                </span>

                <div className="scoreBar">
                  <div style={{ width: `${healthScore}%` }} />
                </div>
              </article>

              <article className="summaryCard">
                <div>
                  <p>Mayor déficit</p>
                  <strong>{recommendation?.ticker}</strong>
                </div>

                <span>
                  {recommendation?.gap.toFixed(2)} puntos bajo el objetivo
                </span>
              </article>
            </section>

            <section className="sectionBlock">
              <div className="sectionHeader">
                <div>
                  <p className="eyebrow">Distribución actual</p>
                  <section className="card">
  <h2>Evolución del patrimonio</h2>
<div style={{ width: "100%", height: 260, marginBottom: 20 }}>
  <ResponsiveContainer>
    <LineChart data={chartData}>
      <XAxis dataKey="date" />
      <YAxis hide />
      <Tooltip />
      <Line
        type="monotone"
        dataKey="totalCLP"
        stroke="#22c55e"
        strokeWidth={3}
        dot={false}
      />
    </LineChart>
  </ResponsiveContainer>
</div>
  {history.length === 0 ? (
    <p>Aún no hay historial.</p>
  ) : (
    <>
      {history.map((h) => (
        <div
          key={h.date}
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span>{h.date}</span>
          <strong>{clp.format(h.totalCLP)}</strong>
        </div>
      ))}
    </>
  )}
</section>
                  <h2>Portafolio</h2>
                </div>
              </div>

              <div className="assetGrid">
                {data.assets.map((asset) => {
                  const target = TARGETS[asset.ticker];
                  const difference = asset.weight - target;

                  return (
                    <article className="assetCard" key={asset.ticker}>
                      <div className="assetHeader">
                        <div>
                          <span className="tickerBadge">
                            {asset.ticker}
                          </span>

                          <h3>{asset.name}</h3>
                        </div>

                        <strong>{asset.weight.toFixed(2)}%</strong>
                      </div>

                      <div className="assetValue">
                        {asset.currency === 'USD'
                          ? usd.format(asset.valueNative)
                          : clp.format(asset.valueNative)}
                      </div>

                      <div className="allocationTrack">
                        <div
                          style={{
                            width: `${Math.min(
                              100,
                              (asset.weight / target) * 100,
                            )}%`,
                          }}
                        />
                      </div>

                      <div className="assetFooter">
                        <span>Objetivo {target}%</span>

                        <span
                          className={
                            difference > 0
                              ? 'overweight'
                              : 'underweight'
                          }
                        >
                          {difference >= 0 ? '+' : ''}
                          {difference.toFixed(2)} pts
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="decisionCard">
              <div className="decisionIcon">M</div>

              <div>
                <p className="eyebrow">Centro de decisiones</p>
                <h2>¿Qué hago hoy?</h2>

                <p>
                  Tu activo más alejado por debajo de la distribución
                  objetivo es <strong>{recommendation?.ticker}</strong>.
                </p>

                <div className="aporteBox">
                  <label htmlFor="aporte">
                    Monto del próximo aporte
                  </label>

                  <input
                    id="aporte"
                    type="number"
                    min="0"
                    step="10000"
                    value={aporte}
                    onChange={(e) =>
                      setAporte(Number(e.target.value))
                    }
                  />

                  <div className="aportePlan">
                    {contributionPlan.map((item) => (
                      <div
                        className="aporteResultado"
                        key={item.ticker}
                      >
                        <span>{item.ticker}</span>
                        <strong>{clp.format(item.amount)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {tab === 'portafolio' && (
          <section className="detailCard">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Composición</p>
                <h2>Cómo se forma el patrimonio</h2>
              </div>
            </div>

            <div className="detailList">
              {data.assets.map((asset) => (
                <div className="detailRow" key={asset.ticker}>
                  <span>{asset.ticker}</span>
                  <strong>{clp.format(asset.valueCLP)}</strong>
                </div>
              ))}

              <div className="detailRow">
                <span>Caja</span>
                <strong>{clp.format(data.cashCLP)}</strong>
              </div>

              <div className="detailRow totalRow">
                <span>Total</span>
                <strong>{clp.format(data.totalCLP)}</strong>
              </div>
            </div>

            <p className="note">
              La valorización puede diferir levemente de Racional por el
              tipo de cambio, redondeos o desfases de mercado.
            </p>
          </section>
        )}
{tab === 'rendimiento' && (
  <section className="detailCard">
    <div className="sectionHeader">
      <div>
        <p className="eyebrow">Análisis</p>
        <h2>Rendimiento</h2>
      </div>
    </div>

    <div className="detailList">
      <div className="detailRow">
        <span>Capital invertido</span>
        <strong>{clp.format(capitalInvertido)}</strong>
      </div>

      <div className="detailRow">
        <span>Ganancia total</span>
        <strong>
          {clp.format(Math.round(data.totalCLP) - capitalInvertido)}
        </strong>
      </div>

      <div className="detailRow totalRow">
        <span>Rentabilidad</span>
        <strong>
          {(
            ((data.totalCLP - capitalInvertido) / capitalInvertido) *
            100
          ).toFixed(2)}
          %
        </strong>
      </div>
    </div>
  </section>
)}
{tab === 'configuracion' && (
  <section className="detailCard">
    <div className="sectionHeader">
      <div>
        <p className="eyebrow">Configuración</p>
        <h2>Mirror José</h2>
      </div>
    </div>

    <div className="detailList">
      <div className="detailRow">
        <span>Meta patrimonial</span>
        <strong>{clp.format(600000000)}</strong>
      </div>

      <div className="detailRow">
        <span>Tipo de cambio</span>
        <strong>${data.usdclp} CLP/USD</strong>
      </div>

      <div className="detailRow">
        <span>Última actualización</span>
        <strong>{new Date(data.updatedAt).toLocaleString("es-CL")}</strong>
      </div>
    </div>
  </section>
)}
{tab === 'libertad' && (
  <section className="detailCard">
    <div className="sectionHeader">
      <div>
        <p className="eyebrow">Objetivo personal</p>
        <h2>Libertad financiera</h2>
      </div>
    </div>

    <div className="detailList">
      <div className="detailRow">
        <span>Meta patrimonial</span>
        <strong>{clp.format(600000000)}</strong>
      </div>

      <div className="detailRow">
        <span>Patrimonio actual</span>
        <strong>{clp.format(data.totalCLP)}</strong>
      </div>

      <div className="detailRow">
        <span>Falta por alcanzar</span>
        <strong>{clp.format(600000000 - data.totalCLP)}</strong>
      </div>

      <div className="detailRow totalRow">
        <span>Avance</span>
        <strong>
          {((data.totalCLP / 600000000) * 100).toFixed(2)}%
        </strong>
      </div>
    </div>
  </section>
)}
        {tab === 'aportes' && (
          <section className="detailCard">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Información registrada</p>
                <h2>Participaciones</h2>
              </div>
            </div>

            <div className="detailList">
              <div className="detailRow">
                <span>VOO</span>
                <strong>9,43928896</strong>
              </div>

              <div className="detailRow">
                <span>SMH</span>
                <strong>2,23582414</strong>
              </div>

              <div className="detailRow">
                <span>BCH</span>
                <strong>14,17875002</strong>
              </div>

              <div className="detailRow">
                <span>CFIETFGE</span>
                <strong>431 cuotas</strong>
              </div>
            </div>
          </section>
        )}
      </main>

      <nav className="bottomNav">
      <button
  type="button"
  className={tab === 'inicio' ? 'active' : ''}
  onClick={() => setTab('inicio')}
>
  Inicio
</button>

<button
  type="button"
  className={tab === 'portafolio' ? 'active' : ''}
  onClick={() => setTab('portafolio')}
>
  Portafolio
</button>

<button
  type="button"
  className={tab === 'aportes' ? 'active' : ''}
  onClick={() => setTab('aportes')}
>
  Aportes
</button>

<button
  type="button"
  className={tab === 'rendimiento' ? 'active' : ''}
  onClick={() => setTab('rendimiento')}
>
  Rendimiento
</button>

<button
  type="button"
  className={tab === 'libertad' ? 'active' : ''}
  onClick={() => setTab('libertad')}
>
  Libertad
</button>

<button
  type="button"
  className={tab === 'configuracion' ? 'active' : ''}
  onClick={() => setTab('configuracion')}
>
  Config.
</button>
      </nav>
    </div>
  );
}