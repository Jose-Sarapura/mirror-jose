export default function HeroCard({
  data,
  capitalInvertido,
  racionalTotal,
  clp,
  load,
}) {
  const patrimonio = Math.round(data.totalCLP);
  const ganancia = patrimonio - capitalInvertido;
  const rentabilidad =
    capitalInvertido > 0
      ? (ganancia / capitalInvertido) * 100
      : 0;

  const diferencia = patrimonio - racionalTotal;

  return (
    <section className="heroCard">
      <div className="heroContent">
        <p className="eyebrow">Patrimonio total</p>

        <h2>{clp.format(patrimonio)}</h2>

        <div className="comparisonBox">
          <div className="returnBox">
            <span>Rentabilidad total</span>
            <strong>{clp.format(ganancia)}</strong>
            <small>{rentabilidad.toFixed(2)}%</small>
          </div>

          <div>
            <span>Racional</span>
            <strong>{clp.format(racionalTotal)}</strong>
          </div>

          <div>
            <span>Mirror</span>
            <strong>{clp.format(patrimonio)}</strong>
          </div>

          <div>
            <span>Diferencia</span>
            <strong>{clp.format(diferencia)}</strong>
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
  );
}