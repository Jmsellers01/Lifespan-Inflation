import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const clampCurrencyInput = (value: number) =>
  Math.min(Math.max(value, 1), 1_000_000);

const App = () => {
  const [startingCost, setStartingCost] = useState(100);
  const [assetInflation, setAssetInflation] = useState(7);
  const [fiatDeflation, setFiatDeflation] = useState(3);
  const [years, setYears] = useState(30);

  const { data, finalNominal, finalReal, netRate } = useMemo(() => {
    const ai = assetInflation / 100;
    const fd = fiatDeflation / 100;
    const net = (1 + ai) / (1 + fd) - 1;

    const points = Array.from({ length: years + 1 }, (_, t) => {
      const nominal = startingCost * Math.pow(1 + ai, t);
      const real = nominal / Math.pow(1 + fd, t);
      return {
        year: t,
        nominal,
        real,
      };
    });

    const last = points[points.length - 1] ?? {
      nominal: startingCost,
      real: startingCost,
    };

    return {
      data: points,
      finalNominal: last.nominal,
      finalReal: last.real,
      netRate: net,
    };
  }, [assetInflation, fiatDeflation, years, startingCost]);

  return (
    <div className="page">
      <div className="card">
        <header className="header">
          <div>
            <p className="eyebrow">Lifespan Inflation Model</p>
            <h1>Cost Trajectory Over Time</h1>
            <p className="subtext">
              Compare nominal asset inflation to fiat-adjusted real costs as
              purchasing power changes.
            </p>
          </div>
        </header>

        <section className="controls">
          <div className="control">
            <label htmlFor="startingCost">Starting cost (C0)</label>
            <div className="control-row">
              <input
                id="startingCost"
                type="number"
                min={1}
                max={1_000_000}
                step={1}
                value={startingCost}
                onChange={(event) =>
                  setStartingCost(
                    clampCurrencyInput(Number(event.target.value))
                  )
                }
              />
              <span className="value">{formatCurrency(startingCost)}</span>
            </div>
          </div>
          <div className="control">
            <label htmlFor="assetInflation">Asset inflation (ai)</label>
            <div className="control-row">
              <input
                id="assetInflation"
                type="range"
                min={0}
                max={30}
                step={0.1}
                value={assetInflation}
                onChange={(event) =>
                  setAssetInflation(Number(event.target.value))
                }
              />
              <span className="value">{formatPercent(assetInflation)}</span>
            </div>
          </div>
          <div className="control">
            <label htmlFor="fiatDeflation">Fiat deflation (fd)</label>
            <div className="control-row">
              <input
                id="fiatDeflation"
                type="range"
                min={0}
                max={30}
                step={0.1}
                value={fiatDeflation}
                onChange={(event) =>
                  setFiatDeflation(Number(event.target.value))
                }
              />
              <span className="value">{formatPercent(fiatDeflation)}</span>
            </div>
          </div>
          <div className="control">
            <label htmlFor="years">Time (years)</label>
            <div className="control-row">
              <input
                id="years"
                type="range"
                min={0}
                max={80}
                step={1}
                value={years}
                onChange={(event) => setYears(Number(event.target.value))}
              />
              <span className="value">{years} yrs</span>
            </div>
          </div>
        </section>

        <section className="summary">
          <div>
            <span>Starting cost</span>
            <strong>{formatCurrency(startingCost)}</strong>
          </div>
          <div>
            <span>Asset inflation (ai)</span>
            <strong>{formatPercent(assetInflation)}</strong>
          </div>
          <div>
            <span>Fiat deflation (fd)</span>
            <strong>{formatPercent(fiatDeflation)}</strong>
          </div>
          <div>
            <span>Net effective rate (r_net)</span>
            <strong>{formatPercent(netRate * 100)}</strong>
          </div>
          <div>
            <span>Final nominal cost</span>
            <strong>{formatCurrency(finalNominal)}</strong>
          </div>
          <div>
            <span>Final real cost</span>
            <strong>{formatCurrency(finalReal)}</strong>
          </div>
        </section>

        <section className="chart">
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="year" tickMargin={8} />
              <YAxis
                tickFormatter={(value) =>
                  new Intl.NumberFormat("en-US", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(value)
                }
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => `Year ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="nominal"
                name="Nominal cost"
                stroke="#2563eb"
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="real"
                name="Fiat-adjusted real cost"
                stroke="#10b981"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </div>
    </div>
  );
};

export default App;
