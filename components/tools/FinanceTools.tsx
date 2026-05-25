"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { openAuthDialog } from "@/lib/client/coinlit-storage";

type Rates = Record<string, { usd: number }>;

type TradeSide = "long" | "short";

type TradeRow = {
  id: string;
  date: string;
  pair: string;
  side: TradeSide;
  entry: number;
  exit: number;
  stop: number;
  size: number;
  fee: number;
  note: string;
  pnl: number;
  riskAmount: number;
  rMultiple: number;
};

const journalKey = "coinlit_trades";

function round(value: number, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

export function FinanceTools() {
  const [amount, setAmount] = useState(600);
  const [months, setMonths] = useState(24);
  const [yieldRate, setYieldRate] = useState(14);

  const [cryptoAmount, setCryptoAmount] = useState(0.1);
  const [coin, setCoin] = useState("bitcoin");
  const [rates, setRates] = useState<Rates>({ bitcoin: { usd: 65000 }, ethereum: { usd: 3200 } });

  const [accountSize, setAccountSize] = useState(2500);
  const [riskPercent, setRiskPercent] = useState(1.5);
  const [entryPrice, setEntryPrice] = useState(42000);
  const [stopPrice, setStopPrice] = useState(40400);
  const [takeProfitPrice, setTakeProfitPrice] = useState(47000);

  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [storageMode, setStorageMode] = useState<"server" | "local">("local");

  const [tradeDate, setTradeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tradePair, setTradePair] = useState("BTC/USDT");
  const [tradeSide, setTradeSide] = useState<TradeSide>("long");
  const [tradeEntry, setTradeEntry] = useState(42000);
  const [tradeExit, setTradeExit] = useState(43650);
  const [tradeStop, setTradeStop] = useState(40500);
  const [tradeSize, setTradeSize] = useState(0.03);
  const [tradeFee, setTradeFee] = useState(4.8);
  const [tradeNote, setTradeNote] = useState("Вход по подтверждению от уровня");

  const loadTrades = useCallback(async () => {
    try {
      const response = await fetch("/api/trades", { cache: "no-store" });
      if (!response.ok) throw new Error("no-session");
      const data = (await response.json()) as { trades: TradeRow[]; source?: string };
      if (data.source === "no-db") throw new Error("local-fallback");
      setTrades(data.trades ?? []);
      setStorageMode("server");
      return;
    } catch {
      const raw = localStorage.getItem(journalKey);
      if (!raw) {
        setTrades([]);
      } else {
        try {
          setTrades(JSON.parse(raw) as TradeRow[]);
        } catch {
          setTrades([]);
        }
      }
      setStorageMode("local");
    }
  }, []);

  useEffect(() => {
    fetch("/api/rates")
      .then((response) => response.json())
      .then((data) => setRates(data.rates))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadTrades();
    window.addEventListener("coinlit:user-updated", loadTrades);
    return () => window.removeEventListener("coinlit:user-updated", loadTrades);
  }, [loadTrades]);

  useEffect(() => {
    if (storageMode === "local") {
      localStorage.setItem(journalKey, JSON.stringify(trades));
    }
  }, [storageMode, trades]);

  const future = useMemo(() => {
    const monthly = yieldRate / 100 / 12;
    return Math.round(amount * ((Math.pow(1 + monthly, months) - 1) / monthly || months));
  }, [amount, months, yieldRate]);

  const usd = cryptoAmount * (rates[coin]?.usd ?? 0);

  const riskAmount = useMemo(() => round((accountSize * riskPercent) / 100, 2), [accountSize, riskPercent]);
  const stopDistance = useMemo(() => Math.abs(entryPrice - stopPrice), [entryPrice, stopPrice]);
  const stopPercent = useMemo(() => round((stopDistance / entryPrice) * 100, 2), [entryPrice, stopDistance]);
  const positionSize = useMemo(() => {
    if (stopDistance <= 0) return 0;
    return round(riskAmount / stopDistance, 6);
  }, [riskAmount, stopDistance]);
  const positionValue = useMemo(() => round(positionSize * entryPrice, 2), [entryPrice, positionSize]);
  const rr = useMemo(() => {
    const rewardDistance = Math.abs(takeProfitPrice - entryPrice);
    if (stopDistance <= 0) return 0;
    return round(rewardDistance / stopDistance, 2);
  }, [entryPrice, stopDistance, takeProfitPrice]);

  const summary = useMemo(() => {
    const total = trades.length;
    if (!total) return { total, wins: 0, winRate: 0, pnl: 0, avgR: 0 };
    const wins = trades.filter((row) => row.pnl > 0).length;
    const pnl = round(trades.reduce((sum, row) => sum + row.pnl, 0), 2);
    const avgR = round(trades.reduce((sum, row) => sum + row.rMultiple, 0) / total, 2);
    return { total, wins, winRate: round((wins / total) * 100, 1), pnl, avgR };
  }, [trades]);

  async function addTrade() {
    const direction = tradeSide === "long" ? 1 : -1;
    const gross = direction * (tradeExit - tradeEntry) * tradeSize;
    const pnl = round(gross - tradeFee, 2);
    const riskAbs = round(Math.abs(tradeEntry - tradeStop) * tradeSize, 2);
    const rMultiple = riskAbs > 0 ? round(pnl / riskAbs, 2) : 0;

    const row: TradeRow = {
      id: `${Date.now()}`,
      date: tradeDate,
      pair: tradePair.trim() || "—",
      side: tradeSide,
      entry: tradeEntry,
      exit: tradeExit,
      stop: tradeStop,
      size: tradeSize,
      fee: tradeFee,
      note: tradeNote.trim(),
      pnl,
      riskAmount: riskAbs,
      rMultiple
    };

    if (storageMode === "server") {
      try {
        const response = await fetch("/api/trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row)
        });
        if (response.ok) {
          const body = (await response.json().catch(() => ({ fallback: false }))) as { fallback?: boolean };
          if (body.fallback) {
            setStorageMode("local");
            setTrades((items) => [row, ...items]);
            return;
          }
          await loadTrades();
          return;
        }
        if (response.status === 401) {
          openAuthDialog("login");
        }
      } catch {
        // continue to local fallback
      }
    }

    setTrades((items) => [row, ...items]);
  }

  async function removeTrade(id: string) {
    if (storageMode === "server") {
      try {
        const response = await fetch(`/api/trades?id=${id}`, { method: "DELETE" });
        if (response.ok) {
          const body = (await response.json().catch(() => ({ fallback: false }))) as { fallback?: boolean };
          if (body.fallback) {
            setStorageMode("local");
            setTrades((items) => items.filter((row) => row.id !== id));
            return;
          }
          await loadTrades();
          return;
        }
      } catch {
        // fallback below
      }
    }
    setTrades((items) => items.filter((row) => row.id !== id));
  }

  return (
    <div className="tool-grid">
      <article className="card">
        <span className="chip">Калькулятор накопления</span>
        <h3>Инвестиционный план</h3>
        <label className="field">
          Ежемесячный взнос, $
          <input className="input" type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
        </label>
        <label className="field">
          Горизонт, месяцев
          <input className="input" type="number" value={months} onChange={(event) => setMonths(Number(event.target.value))} />
        </label>
        <label className="field">
          Ожидаемая доходность, % годовых
          <input className="input" type="number" value={yieldRate} onChange={(event) => setYieldRate(Number(event.target.value))} />
        </label>
        <h3>${future.toLocaleString("en-US")}</h3>
        <p className="muted">Используй калькулятор для оценки долгосрочных накоплений и проверки реальности финансовой цели.</p>
      </article>

      <article className="card">
        <span className="chip">Котировки</span>
        <h3>Конвертер BTC/ETH</h3>
        <label className="field">
          Актив
          <select className="input" value={coin} onChange={(event) => setCoin(event.target.value)}>
            <option value="bitcoin">Bitcoin</option>
            <option value="ethereum">Ethereum</option>
          </select>
        </label>
        <label className="field">
          Количество монет
          <input
            className="input"
            type="number"
            step="0.0001"
            value={cryptoAmount}
            onChange={(event) => setCryptoAmount(Number(event.target.value))}
          />
        </label>
        <h3>${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}</h3>
        <p className="muted">Подходит для быстрых расчетов перед покупкой, продажей и ребалансировкой портфеля.</p>
      </article>

      <article className="card">
        <span className="chip">Риск-менеджмент</span>
        <h3>Размер позиции под лимит риска</h3>
        <label className="field">
          Размер капитала, $
          <input className="input" type="number" value={accountSize} onChange={(event) => setAccountSize(Number(event.target.value))} />
        </label>
        <label className="field">
          Риск на сделку, %
          <input className="input" type="number" step="0.1" value={riskPercent} onChange={(event) => setRiskPercent(Number(event.target.value))} />
        </label>
        <label className="field">
          Цена входа
          <input className="input" type="number" value={entryPrice} onChange={(event) => setEntryPrice(Number(event.target.value))} />
        </label>
        <label className="field">
          Стоп-цена
          <input className="input" type="number" value={stopPrice} onChange={(event) => setStopPrice(Number(event.target.value))} />
        </label>
        <label className="field">
          Цель (take-profit)
          <input className="input" type="number" value={takeProfitPrice} onChange={(event) => setTakeProfitPrice(Number(event.target.value))} />
        </label>

        <div className="kpi-grid" style={{ marginTop: 12 }}>
          <div className="kpi-card">
            <span className="muted">Риск, $</span>
            <b>{riskAmount}</b>
          </div>
          <div className="kpi-card">
            <span className="muted">Стоп, %</span>
            <b>{stopPercent}</b>
          </div>
          <div className="kpi-card">
            <span className="muted">Размер позиции</span>
            <b>{positionSize}</b>
          </div>
          <div className="kpi-card">
            <span className="muted">R:R</span>
            <b>1:{rr}</b>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12 }}>
          Примерный объем позиции: ${positionValue}. Если стоп слишком широкий, снизь размер позиции до сохранения лимита риска.
        </p>
      </article>

      <article className="card">
        <span className="chip">Журнал сделок</span>
        <h3>Добавь прошедшую сделку и оцени результат</h3>
        <p className="muted">
          Режим хранения: <b>{storageMode === "server" ? "серверная синхронизация (MySQL)" : "локально в браузере"}</b>.
        </p>

        <label className="field">
          Дата
          <input className="input" type="date" value={tradeDate} onChange={(event) => setTradeDate(event.target.value)} />
        </label>
        <label className="field">
          Пара
          <input className="input" value={tradePair} onChange={(event) => setTradePair(event.target.value)} />
        </label>
        <label className="field">
          Сторона
          <select className="input" value={tradeSide} onChange={(event) => setTradeSide(event.target.value as TradeSide)}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>
        <label className="field">
          Вход
          <input className="input" type="number" value={tradeEntry} onChange={(event) => setTradeEntry(Number(event.target.value))} />
        </label>
        <label className="field">
          Выход
          <input className="input" type="number" value={tradeExit} onChange={(event) => setTradeExit(Number(event.target.value))} />
        </label>
        <label className="field">
          Стоп
          <input className="input" type="number" value={tradeStop} onChange={(event) => setTradeStop(Number(event.target.value))} />
        </label>
        <label className="field">
          Размер позиции (кол-во)
          <input className="input" type="number" step="0.0001" value={tradeSize} onChange={(event) => setTradeSize(Number(event.target.value))} />
        </label>
        <label className="field">
          Комиссии, $
          <input className="input" type="number" step="0.01" value={tradeFee} onChange={(event) => setTradeFee(Number(event.target.value))} />
        </label>
        <label className="field">
          Комментарий
          <input className="input" value={tradeNote} onChange={(event) => setTradeNote(event.target.value)} />
        </label>
        <button className="btn" type="button" onClick={addTrade}>
          Добавить сделку в журнал
        </button>
      </article>

      <article className="card" style={{ gridColumn: "1 / -1" }}>
        <span className="chip">Портфель и история сделок</span>
        <h3>Аналитика в одном месте</h3>
        <div className="kpi-grid" style={{ marginBottom: 12 }}>
          <div className="kpi-card">
            <span className="muted">Всего сделок</span>
            <b>{summary.total}</b>
          </div>
          <div className="kpi-card">
            <span className="muted">Win-rate</span>
            <b>{summary.winRate}%</b>
          </div>
          <div className="kpi-card">
            <span className="muted">Суммарный PnL</span>
            <b className={summary.pnl >= 0 ? "badge-positive" : "badge-negative"}>{summary.pnl}$</b>
          </div>
          <div className="kpi-card">
            <span className="muted">Средний R</span>
            <b>{summary.avgR}</b>
          </div>
        </div>

        {trades.length === 0 ? (
          <div className="empty-state">Сделок пока нет. Добавь первую запись, чтобы начать анализ.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Пара</th>
                  <th>Side</th>
                  <th>Вход</th>
                  <th>Выход</th>
                  <th>Риск $</th>
                  <th>PnL $</th>
                  <th>R</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {trades.map((row) => (
                  <tr key={row.id}>
                    <td>{row.date}</td>
                    <td>{row.pair}</td>
                    <td>{row.side}</td>
                    <td>{row.entry}</td>
                    <td>{row.exit}</td>
                    <td>{row.riskAmount}</td>
                    <td className={row.pnl >= 0 ? "badge-positive" : "badge-negative"}>{row.pnl}</td>
                    <td>{row.rMultiple}</td>
                    <td>
                      <button className="btn ghost" type="button" onClick={() => removeTrade(row.id)}>
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="card" style={{ gridColumn: "1 / -1" }}>
        <span className="chip">Чек-лист перед входом</span>
        <h3>Быстрый self-check трейдера</h3>
        <div className="checkbox-row">
          <label><input type="checkbox" /> Есть сценарий входа и сценарий отмены</label>
          <label><input type="checkbox" /> Риск на сделку не выше лимита</label>
          <label><input type="checkbox" /> Есть план фиксации прибыли</label>
          <label><input type="checkbox" /> Решение принято не из FOMO</label>
          <label><input type="checkbox" /> Сделка будет занесена в журнал</label>
        </div>
      </article>
    </div>
  );
}
