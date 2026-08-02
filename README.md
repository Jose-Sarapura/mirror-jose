# Mirror José

Aplicación patrimonial personal construida con Next.js 15.

## Versiones

- `/` mantiene la versión original.
- `/dashboard` abre **Mirror Wealth V2**.
- `/dashboard/activo/SMH` y las demás rutas muestran el análisis individual de cada activo.

## Mirror Wealth V2

Incluye:

- precios de mercado y tipo de cambio;
- patrimonio, rentabilidad y progreso hacia la meta;
- estrategia objetivo 60% VOO, 20% SMH, 10% BCH y 10% Acciones Globales;
- cantidad de participaciones, costo promedio y valor de cada posición;
- rebalanceo y sugerencia del próximo aporte;
- gráficos de 1 día, 1 mes, 1 año y 5 años;
- línea de costo promedio y compras registradas;
- simulador de nuevas compras;
- escenarios patrimoniales y por activo hasta 2030;
- configuración editable guardada localmente.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000/dashboard`.

## Publicar

El proyecto mantiene la configuración existente para GitHub y Vercel. No requiere dependencias nuevas.
