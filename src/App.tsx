import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ScaleMode = "linear" | "log";

type YearPoint = {
  year: number;
  cumUsd: number;
  cumBtc: number;
};

const FALLBACK_BTC_PRICE = 60_000;

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatCompactCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 1,
  }).format(value);

const formatBtc = (value: number) => {
  const formatted = value.toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  return `${formatted} BTC`;
};

const formatCompactBtc = (value: number) =>
  value.toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");

const formatUpdatedAt = (iso: string | null) => {
  if (!iso) {
    return "Not available";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString();
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const App = () => {
  const [inflationPercent, setInflationPercent] = useState(3.0);
  const [assetGrowthPercent, setAssetGrowthPercent] = useState(7.0);
  const [extraYears, setExtraYears] = useState(10);
  const [annualExpenseToday, setAnnualExpenseToday] = useState(60_000);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("linear");

  const [fetchedBtcPrice, setFetchedBtcPrice] = useState(FALLBACK_BTC_PRICE);
  const [btcPriceInput, setBtcPriceInput] = useState(String(FALLBACK_BTC_PRICE));
  const [btcUpdatedAt, setBtcUpdatedAt] = useState<string | null>(null);
  const [btcFetchWarning, setBtcFetchWarning] = useState<string | null>(
    "Using fallback BTC price until market data loads.",
  );

  useEffect(() => {
    const loadBtcPrice = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true",
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as {
          bitcoin?: { usd?: number; last_updated_at?: number };
        };

        const usdPrice = payload.bitcoin?.usd;
        if (!usdPrice || usdPrice <= 0) {
          throw new Error("CoinGecko response missing positive usd price");
        }

        const updatedIso = payload.bitcoin?.last_updated_at
          ? new Date(payload.bitcoin.last_updated_at * 1000).toISOString()
          : new Date().toISOString();

        setFetchedBtcPrice(usdPrice);
        setBtcPriceInput(String(usdPrice));
        setBtcUpdatedAt(updatedIso);
        setBtcFetchWarning(null);
      } catch {
        setFetchedBtcPrice(FALLBACK_BTC_PRICE);
        setBtcPriceInput(String(FALLBACK_BTC_PRICE));
        setBtcUpdatedAt(null);
        setBtcFetchWarning("Could not fetch BTC price from CoinGecko. Using fallback P0 = 60,000 USD.");
      }
    };

    void loadBtcPrice();
  }, []);

  const effectiveBtcPrice = useMemo(() => {
    const parsed = Number(btcPriceInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fetchedBtcPrice;
    }
    return parsed;
  }, [btcPriceInput, fetchedBtcPrice]);

  const { series, chartSeries, cumUsdAtT, cumBtcAtT, lifespanInflationFactor, minPositiveUsd, minPositiveBtc } =
    useMemo(() => {
      const i = inflationPercent / 100;
      const a = assetGrowthPercent / 100;

      const ratioBase = (1 + i) / (1 + a);
      const lif = Math.pow(ratioBase, extraYears) - 1;

      const points: YearPoint[] = [];
      let runningUsdTotal = 0;
      let runningBtcTotal = 0;

      for (let k = 0; k <= extraYears; k += 1) {
        const expenseUsd = annualExpenseToday * Math.pow(1 + i, k);
        const btcPrice = effectiveBtcPrice * Math.pow(1 + a, k);
        const expenseBtc = expenseUsd / btcPrice;

        if (k > 0) {
          runningUsdTotal += expenseUsd;
          runningBtcTotal += expenseBtc;
        }

        points.push({
          year: k,
          cumUsd: runningUsdTotal,
          cumBtc: runningBtcTotal,
        });
      }

      const trimmedPoints = scaleMode === "log" ? points.filter((point) => point.year > 0) : points;

      const usdPositives = trimmedPoints.map((point) => point.cumUsd).filter((value) => value > 0);
      const btcPositives = trimmedPoints.map((point) => point.cumBtc).filter((value) => value > 0);

      return {
        series: points,
        chartSeries: trimmedPoints,
        cumUsdAtT: points[points.length - 1]?.cumUsd ?? 0,
        cumBtcAtT: points[points.length - 1]?.cumBtc ?? 0,
        lifespanInflationFactor: lif,
        minPositiveUsd: usdPositives.length > 0 ? Math.min(...usdPositives) : 1,
        minPositiveBtc: btcPositives.length > 0 ? Math.min(...btcPositives) : 1e-6,
      };
    }, [inflationPercent, assetGrowthPercent, extraYears, annualExpenseToday, effectiveBtcPrice, scaleMode]);

  const warnings = [
    btcFetchWarning,
    scaleMode === "log" ? "Log scale excludes year 0 to avoid non-positive values." : null,
    Number(btcPriceInput) <= 0 ? "BTC price override must be positive. Using latest fetched value." : null,
  ].filter(Boolean) as string[];

  return (
    <main className="page">
      <div className="card">
        <header className="header">
          <p className="eyebrow">Lifespan Inflation Model</p>
          <h1>Cumulative Cost Over Extra Years Lived</h1>
          <p className="subtext">E_usd(k) = E0*(1+i)^k, P_btc(k) = P0*(1+a)^k, E_btc(k) = E_usd(k)/P_btc(k)</p>
        </header>

        <section className="controls" aria-label="Inputs">
          <div className="control">
            <label htmlFor="inflation">Inflation (i)</label>
            <div className="control-row">
              <input
                id="inflation"
                type="range"
                min={0}
                max={20}
                step={0.1}
                value={inflationPercent}
                onChange={(event) => setInflationPercent(Number(event.target.value))}
              />
              <span className="value">{formatPercent(inflationPercent)}</span>
            </div>
          </div>

          <div className="control">
            <label htmlFor="assetGrowth">BTC appreciation (a)</label>
            <div className="control-row">
              <input
                id="assetGrowth"
                type="range"
                min={-10}
                max={30}
                step={0.1}
                value={assetGrowthPercent}
                onChange={(event) => setAssetGrowthPercent(Number(event.target.value))}
              />
              <span className="value">{formatPercent(assetGrowthPercent)}</span>
            </div>
          </div>

          <div className="control">
            <label htmlFor="extraYears">Extra years (T)</label>
            <div className="control-row">
              <input
                id="extraYears"
                type="range"
                min={0}
                max={60}
                step={1}
                value={extraYears}
                onChange={(event) => setExtraYears(Number(event.target.value))}
              />
              <span className="value">{extraYears} yrs</span>
            </div>
          </div>

          <div className="control">
            <label htmlFor="annualExpense">Annual expenses today (E0)</label>
            <div className="control-row">
              <input
                id="annualExpense"
                type="number"
                min={0}
                step={100}
                value={annualExpenseToday}
                onChange={(event) =>
                  setAnnualExpenseToday(clamp(Number(event.target.value) || 0, 0, 10_000_000))
                }
              />
              <span className="value">{formatCurrency(annualExpenseToday)}</span>
            </div>
          </div>

          <div className="control">
            <label htmlFor="btcPrice">BTC price override (P0, USD)</label>
            <div className="control-row">
              <input
                id="btcPrice"
                type="number"
                min={1}
                step={100}
                value={btcPriceInput}
                onChange={(event) => setBtcPriceInput(event.target.value)}
              />
              <span className="value">{formatCurrency(effectiveBtcPrice)}</span>
            </div>
            <small className="meta">Current fetched price: {formatCurrency(fetchedBtcPrice)}</small>
            <small className="meta">Last updated: {formatUpdatedAt(btcUpdatedAt)}</small>
          </div>

          <div className="control">
            <label htmlFor="scaleMode">Scale</label>
            <div className="control-row control-row--toggle">
              <select
                id="scaleMode"
                value={scaleMode}
                onChange={(event) => setScaleMode(event.target.value as ScaleMode)}
              >
                <option value="linear">Linear</option>
                <option value="log">Log</option>
              </select>
              <span className="value">{scaleMode === "linear" ? "Linear" : "Log"}</span>
            </div>
          </div>
        </section>

        <section className="summary" aria-label="Summary outputs">
          <div>
            <span>Cumulative USD cost at T</span>
            <strong>{formatCurrency(cumUsdAtT)}</strong>
          </div>
          <div>
            <span>Cumulative BTC cost at T</span>
            <strong>{formatBtc(cumBtcAtT)}</strong>
          </div>
          <div>
            <span>Lifespan Inflation Factor LIF(T)</span>
            <strong>{lifespanInflationFactor.toFixed(4)}</strong>
          </div>
          <div>
            <span>LIF(T) as %</span>
            <strong>{formatPercent(lifespanInflationFactor * 100)}</strong>
          </div>
          <div>
            <span>Warnings</span>
            <strong>{warnings.length > 0 ? warnings.join(" ") : "None"}</strong>
          </div>
          <div>
            <span>Plotted points</span>
            <strong>
              {chartSeries.length} of {series.length} years
            </strong>
          </div>
        </section>

        <section className="chart-stack" aria-label="Cumulative cost charts">
          <div className="chart">
            <h2>Chart A: Cumulative cost (USD)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartSeries} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" label={{ value: "Year", position: "insideBottom", offset: -6 }} />
                <YAxis
                  width={120}
                  scale={scaleMode}
                  domain={scaleMode === "log" ? [minPositiveUsd, "auto"] : ["auto", "auto"]}
                  tickFormatter={formatCompactCurrency}
                />
                <Tooltip
                  labelFormatter={(label) => `Year ${label}`}
                  formatter={(value: number) => [formatCurrency(value), "Cumulative USD"]}
                />
                <Line
                  type="monotone"
                  dataKey="cumUsd"
                  name="Cumulative USD"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart">
            <h2>Chart B: Cumulative cost (BTC)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartSeries} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" label={{ value: "Year", position: "insideBottom", offset: -6 }} />
                <YAxis
                  width={120}
                  scale={scaleMode}
                  domain={scaleMode === "log" ? [minPositiveBtc, "auto"] : ["auto", "auto"]}
                  tickFormatter={formatCompactBtc}
                />
                <Tooltip
                  labelFormatter={(label) => `Year ${label}`}
                  formatter={(value: number) => [formatBtc(value), "Cumulative BTC"]}
                />
                <Line
                  type="monotone"
                  dataKey="cumBtc"
                  name="Cumulative BTC"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </main>
  );
};

export default App;
