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

type Units = "USD" | "BTC";

type YearPoint = {
  year: number;
  ratio: number;
  E_nom_usd: number;
  P_usd: number;
  E_btc: number;
  P_btc: number;
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

const formatBtc = (value: number) => `${value.toFixed(6)} BTC`;

const formatCompactBtc = (value: number) => `${value.toFixed(3)} BTC`;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const App = () => {
  const [units, setUnits] = useState<Units>("USD");
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
    finalAnnualExpenseUsd,
    finalAnnualExpenseBtc,
    totalExpensesUsd,
    totalExpensesBtc,
    avgAnnualExpenseUsd,
    avgAnnualExpenseBtc,
    finalPortfolioUsd,
    finalPortfolioBtc,
    depletionYear,
  } = useMemo(() => {
    const i = inflationPercent / 100;
    const a = assetGrowthPercent / 100;

    const ratioBase = (1 + i) / (1 + a);
    const lif = Math.pow(ratioBase, extraYears) - 1;

    const points: YearPoint[] = [];
    let runningUsdExpensesTotal = 0;
    let runningBtcExpensesTotal = 0;
    let portfolioUsd = startingPortfolio;
    let depletion: number | null = null;

    for (let k = 0; k <= extraYears; k += 1) {
      const ratio = Math.pow(ratioBase, k);
      const btcUsdIndex = Math.pow(1 + a, k);
      const nominalExpenseUsd = annualExpenseToday * Math.pow(1 + i, k);

      if (k > 0) {
        runningUsdExpensesTotal += nominalExpenseUsd;
      }

      if (k > 0) {
        portfolioUsd = portfolioUsd * (1 + a) - nominalExpenseUsd;
        if (depletion === null && portfolioUsd <= 0) {
          depletion = k;
        }
      }

      const expenseBtc = nominalExpenseUsd / btcUsdIndex;
      const portfolioBtc = portfolioUsd / btcUsdIndex;

      if (k > 0) {
        runningBtcExpensesTotal += expenseBtc;
      }

      points.push({
        year: k,
        ratio,
        E_nom_usd: nominalExpenseUsd,
        P_usd: portfolioUsd,
        E_btc: expenseBtc,
        P_btc: portfolioBtc,
      });
    }

    const finalPoint = points[points.length - 1] ?? {
      ratio: 1,
      E_nom_usd: annualExpenseToday,
      E_btc: annualExpenseToday,
      P_usd: startingPortfolio,
      P_btc: startingPortfolio,
    };

    return {
      series: points,
      lifespanInflationFactor: lif,
      lifespanInflationPercent: lif * 100,
      finalRatio: finalPoint.ratio,
      finalAnnualExpenseUsd: finalPoint.E_nom_usd,
      finalAnnualExpenseBtc: finalPoint.E_btc,
      totalExpensesUsd: runningUsdExpensesTotal,
      totalExpensesBtc: runningBtcExpensesTotal,
      avgAnnualExpenseUsd: extraYears > 0 ? runningUsdExpensesTotal / extraYears : 0,
      avgAnnualExpenseBtc: extraYears > 0 ? runningBtcExpensesTotal / extraYears : 0,
      finalPortfolioUsd: finalPoint.P_usd,
      finalPortfolioBtc: finalPoint.P_btc,
      depletionYear: depletion,
    };
  }, [
    inflationPercent,
    assetGrowthPercent,
    extraYears,
    annualExpenseToday,
    startingPortfolio,
  ]);

  const expenseDataKey = units === "USD" ? "E_nom_usd" : "E_btc";
  const portfolioDataKey = units === "USD" ? "P_usd" : "P_btc";
  const valueFormatter = units === "USD" ? formatCurrency : formatBtc;
  const axisFormatter = units === "USD" ? formatCompactCurrency : formatCompactBtc;

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
            <label htmlFor="units">Units</label>
            <div className="control-row control-row--toggle">
              <select
                id="units"
                value={units}
                onChange={(event) => setUnits(event.target.value as Units)}
              >
                <option value="USD">USD</option>
                <option value="BTC">BTC</option>
              </select>
              <span className="value">{units}</span>
            </div>
          </div>

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
            <span>Final annual expense ({units})</span>
            <strong>
              {units === "USD"
                ? formatCurrency(finalAnnualExpenseUsd)
                : formatBtc(finalAnnualExpenseBtc)}
            </strong>
          </div>
          <div>
            <span>Total expenses over extra years ({units})</span>
            <strong>
              {units === "USD"
                ? formatCurrency(totalExpensesUsd)
                : formatBtc(totalExpensesBtc)}
            </strong>
          </div>
          <div>
            <span>Average annual expense ({units})</span>
            <strong>
              {units === "USD"
                ? formatCurrency(avgAnnualExpenseUsd)
                : formatBtc(avgAnnualExpenseBtc)}
            </strong>
          </div>
          <div>
            <span>Final portfolio ({units})</span>
            <strong>
              {units === "USD" ? formatCurrency(finalPortfolioUsd) : formatBtc(finalPortfolioBtc)}
            </strong>
          </div>
          <div>
            <span>Portfolio depletion year</span>
            <strong>{depletionYear === null ? "Not depleted" : `Year ${depletionYear}`}</strong>
          </div>
        </section>

        <section className="chart" aria-label="Expense and portfolio chart">
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={series} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" label={{ value: "Year", position: "insideBottom", offset: -6 }} />
              <YAxis tickFormatter={axisFormatter} width={120} />
              <Tooltip
                labelFormatter={(label) => `Year ${label}`}
                formatter={(value: number, name: string) => [valueFormatter(value), name]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey={expenseDataKey}
                name="Annual Expense"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey={portfolioDataKey}
                name="Portfolio Balance"
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
