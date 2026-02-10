import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type YearPoint = {
  year: number;
  ratio: number;
  nominalExpense: number;
  assetAdjustedExpense: number;
  portfolio: number;
};

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

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const App = () => {
  const [inflationPercent, setInflationPercent] = useState(3.0);
  const [assetGrowthPercent, setAssetGrowthPercent] = useState(7.0);
  const [extraYears, setExtraYears] = useState(10);
  const [annualExpenseToday, setAnnualExpenseToday] = useState(60_000);
  const [startingPortfolio, setStartingPortfolio] = useState(1_000_000);

  const {
    series,
    lifespanInflationFactor,
    lifespanInflationPercent,
    finalRatio,
    finalNominalExpense,
    finalAssetAdjustedExpense,
    totalNominal,
    totalAssetAdjusted,
    avgNominal,
    avgAssetAdjusted,
    depletionYear,
  } = useMemo(() => {
    const i = inflationPercent / 100;
    const a = assetGrowthPercent / 100;

    const ratioBase = (1 + i) / (1 + a);
    const lif = Math.pow(ratioBase, extraYears) - 1;

    const points: YearPoint[] = [];
    let runningNominalTotal = 0;
    let runningAssetAdjustedTotal = 0;
    let portfolio = startingPortfolio;
    let depletion: number | null = null;

    for (let k = 0; k <= extraYears; k += 1) {
      const ratio = Math.pow(ratioBase, k);
      const nominalExpense = annualExpenseToday * Math.pow(1 + i, k);
      const assetAdjustedExpense = annualExpenseToday * ratio;

      if (k > 0) {
        runningNominalTotal += nominalExpense;
        runningAssetAdjustedTotal += assetAdjustedExpense;
      }

      if (k > 0) {
        portfolio = portfolio * (1 + a) - nominalExpense;
        if (depletion === null && portfolio <= 0) {
          depletion = k;
        }
      }

      points.push({
        year: k,
        ratio,
        nominalExpense,
        assetAdjustedExpense,
        portfolio,
      });
    }

    const finalPoint = points[points.length - 1] ?? {
      ratio: 1,
      nominalExpense: annualExpenseToday,
      assetAdjustedExpense: annualExpenseToday,
    };

    const averageNominal = extraYears > 0 ? runningNominalTotal / extraYears : 0;
    const averageAssetAdjusted =
      extraYears > 0 ? runningAssetAdjustedTotal / extraYears : 0;

    return {
      series: points,
      lifespanInflationFactor: lif,
      lifespanInflationPercent: lif * 100,
      finalRatio: finalPoint.ratio,
      finalNominalExpense: finalPoint.nominalExpense,
      finalAssetAdjustedExpense: finalPoint.assetAdjustedExpense,
      totalNominal: runningNominalTotal,
      totalAssetAdjusted: runningAssetAdjustedTotal,
      avgNominal: averageNominal,
      avgAssetAdjusted: averageAssetAdjusted,
      depletionYear: depletion,
    };
  }, [
    inflationPercent,
    assetGrowthPercent,
    extraYears,
    annualExpenseToday,
    startingPortfolio,
  ]);

  return (
    <main className="page">
      <div className="card">
        <header className="header">
          <p className="eyebrow">Lifespan Inflation Model</p>
          <h1>Inflation-to-Asset Compounding Over Extra Years Lived</h1>
          <p className="subtext">
            Lifespan Inflation Factor = ((1 + i) / (1 + a))^T - 1
          </p>
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
            <label htmlFor="assetGrowth">Asset growth (a)</label>
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
            <label htmlFor="portfolio">Starting portfolio (P0)</label>
            <div className="control-row">
              <input
                id="portfolio"
                type="range"
                min={0}
                max={5_000_000}
                step={10_000}
                value={startingPortfolio}
                onChange={(event) => setStartingPortfolio(Number(event.target.value))}
              />
              <span className="value">{formatCurrency(startingPortfolio)}</span>
            </div>
          </div>
        </section>

        <section className="summary" aria-label="Summary outputs">
          <div>
            <span>Lifespan Inflation Factor (LIF)</span>
            <strong>{lifespanInflationFactor.toFixed(4)}</strong>
          </div>
          <div>
            <span>Lifespan Inflation %</span>
            <strong>{formatPercent(lifespanInflationPercent)}</strong>
          </div>
          <div>
            <span>Final ratio R(T)</span>
            <strong>{finalRatio.toFixed(4)}</strong>
          </div>
          <div>
            <span>Final nominal annual expense E_nom(T)</span>
            <strong>{formatCurrency(finalNominalExpense)}</strong>
          </div>
          <div>
            <span>Final asset-adjusted annual expense E_assetAdj(T)</span>
            <strong>{formatCurrency(finalAssetAdjustedExpense)}</strong>
          </div>
          <div>
            <span>Total nominal expenses over extra years</span>
            <strong>{formatCurrency(totalNominal)}</strong>
          </div>
          <div>
            <span>Total asset-adjusted expenses over extra years</span>
            <strong>{formatCurrency(totalAssetAdjusted)}</strong>
          </div>
          <div>
            <span>Average nominal annual expense</span>
            <strong>{formatCurrency(avgNominal)}</strong>
          </div>
          <div>
            <span>Average asset-adjusted annual expense</span>
            <strong>{formatCurrency(avgAssetAdjusted)}</strong>
          </div>
          <div>
            <span>Portfolio depletion year</span>
            <strong>{depletionYear === null ? "Not depleted" : `Year ${depletionYear}`}</strong>
          </div>
        </section>

        <section className="chart" aria-label="Expense series chart">
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={series} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" label={{ value: "Year", position: "insideBottom", offset: -6 }} />
              <YAxis tickFormatter={formatCompactCurrency} width={110} />
              <Tooltip
                labelFormatter={(label) => `Year ${label}`}
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="nominalExpense"
                name="Nominal annual expense E_nom(k)"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="assetAdjustedExpense"
                name="Asset-adjusted annual expense E_assetAdj(k)"
                stroke="#16a34a"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </div>
    </main>
  );
};

export default App;
