# Basis Arbitrage Toolkit

Dated-futures cash-and-carry: buy spot, sell the dated future, hold to expiry.

This is the one form of **true arbitrage** reachable without colocation or
exchange-member fee tiers. At expiry the future settles to spot by contract
specification, so convergence is contractual rather than probabilistic and the
return is known at entry. The binding constraint is capital, not speed — which
is precisely the constraint an individual can supply.

## Setup

**Nothing to install but Python.** This package is pure standard library -- no
`pip install` step, no API keys, no accounts. Python 3.9 or newer.

### Windows

1. Install Python from https://www.python.org/downloads/ -- **tick "Add python.exe
   to PATH"** on the first screen of the installer.
2. Open PowerShell (Start menu, type `powershell`).
3. Run:

```powershell
git clone https://github.com/Mbsel012/algorithmic_trading_bot.git
cd algorithmic_trading_bot
git checkout claude/hood-arbitrage-trading-wacu3d
python -m arbitrage.cli --demo
```

If you already have the repo, just `cd` into it and run the last two lines.
No `git`? Download the branch as a ZIP from GitHub and unzip it instead.

### macOS / Linux

```bash
git clone https://github.com/Mbsel012/algorithmic_trading_bot.git
cd algorithmic_trading_bot
git checkout claude/hood-arbitrage-trading-wacu3d
python3 -m arbitrage.cli --demo
```

Use `python3` in place of `python` throughout on macOS and Linux.

### Verify it works

`--demo` should print a scan table. If it does, the install is good.
Then run the test suite -- 39 tests, about a second:

```
python -m unittest discover -s arbitrage -t .
```

### Troubleshooting

| Message | Fix |
|---|---|
| `python: command not found` | Python not installed, or not on PATH. Reinstall and tick "Add to PATH" |
| `No module named arbitrage` | You are in the wrong folder. `cd` into `algorithmic_trading_bot` first |
| `could not reach ...` on a live scan | Network, firewall, or a region that blocks the venue. Use `--manual` |

## Quick start

```bash
python -m arbitrage.cli --demo      # synthetic quotes, no network
python -m arbitrage.cli --clock     # timing report only
python -m arbitrage.cli --base BTC  # live public market data

# Cost a trade from two prices read off any exchange screen -- no API at all:
python -m arbitrage.cli --capital 10000 \
  --manual binance:BTC-DEC:100000:103100:103

python -m unittest discover -s arbitrage -t .
```

## What it does

| Module | Responsibility |
|---|---|
| `store.py` | Append-only JSONL history, shared by both monitors |
| `premium.py` | Local MYR premium: log readings, assess persistence |
| `pairs.py` | Pairs / stat-arb screening with a cost gate |
| `basis.py` | Basis maths, annualisation, sizing, liquidation distance |
| `fees.py` | Per-venue taker schedules and round-trip cost |
| `sessions.py` | Session windows, funding times, CME gap, quarterly expiry |
| `venues.py` | Public REST adapters (Binance, OKX) |
| `scanner.py` | Costing, ranking, safety check, report rendering |
| `cli.py` | Command-line entry point |

## Three strategies, one stance

The package now holds three screens. They answer different questions but share
one rule: **reject by default, and make the edge prove itself net of costs.**

| Screen | Question | Reachable on spot-only venues? |
|---|---|---|
| `scanner` | Is the dated-futures basis wide enough? | No — needs a futures venue |
| `premium` | Is local BTC persistently dearer than global? | **Yes** |
| `pairs` | Does this spread revert faster than it costs? | Needs a broker, not a futures venue |

### Local premium

```
premium = (BTC/MYR local) / (BTC/USD global x USD/MYR) - 1
```

```bash
python -m arbitrage.premium --demo
python -m arbitrage.premium --manual 385000 81474.78 4.62   # log one reading
python -m arbitrage.premium --report                        # assess history
```

Two gates, both mandatory. The **median** must clear round-trip cost — median,
not mean, so one spike cannot carry the verdict. And the edge must clear cost on
at least **70% of readings**, because an edge present a third of the time is not
something you can plan around. A single wide reading is never enough; that is
why this logs rather than merely computes.

### Pairs

```bash
python -m arbitrage.pairs --demo
python -m arbitrage.pairs --csv eurusd.csv gbpusd.csv --names EURUSD GBPUSD --cost 0.0005
```

Fits an OLS hedge ratio, measures the spread's z-score and its AR(1)
mean-reversion half-life, then checks that the expected capture at the entry
threshold beats a round trip on **both** legs. Rejects weak correlation,
non-reverting spreads, half-lives over 30 observations, and any edge that costs
more than it earns.

> ⚠️ **Pairs trading is not arbitrage.** Nothing forces a spread to converge.
> A diverging pair can stay diverged until it takes the account with it.
>
> ⚠️ **This is not a cointegration test.** There is no ADF statistic and no
> Johansen procedure here — neither is implementable in the standard library at
> the precision they need. What you get is *evidence* of stationarity. Re-check
> anything this likes with `statsmodels` `adfuller`/`coint` before risking
> capital. A pair that passes here and fails there will lose money.

## The maths

```
gross basis      = (F - S) / S
annualised       = gross basis x 365 / days_to_expiry
net basis        = gross basis - round-trip fees
edge             = annualised net - risk-free rate
tradeable        = edge > required risk premium
```

Worked example — 90 days, spot 100,000, future 102,000:

```
(102,000 - 100,000) / 100,000  = 2.00%
2.00% x 365/90                 = 8.11% annualised, locked at entry
less ~0.30% round-trip fees    = 6.89% annualised net
less 4% risk-free hurdle       = 2.89% edge
```

## Design stance: the scanner is built to say no

Its job is not to find trades. It is to **reject trades that only look
profitable before fees**, and to report honestly when nothing clears. Most of
the time nothing clears — that is the correct answer and the one that keeps
capital intact.

Three deliberate choices follow from that:

- Unknown venues get a **pessimistic** fee fallback, never an optimistic one.
- A venue that fails to respond is **reported**, never silently dropped — a
  truncated scan must not be mistaken for an absence of opportunity.
- A short-dated contract with a positive gross basis is still rejected when fees
  exceed it. Run `--demo` and look at the 11-day OKX row: +0.18% gross becomes
  −3.98% annualised net. That is the single most common way this trade loses.

## Timing

Arbitrage has no single best session — it has a liquidity trade-off:

| Session (UTC) | Hours | Liquidity | Mispricings | Fillable? |
|---|---|---|---|---|
| Sydney | 21:00–06:00 | Lowest | Most | No — slippage exceeds the gap |
| Tokyo | 00:00–09:00 | Medium | Medium | Marginal |
| Tokyo–London | 07:00–09:00 | High | Fewer | Yes |
| London | 07:00–16:00 | High | Fewer | Yes |
| **London–NY** | **12:00–16:00** | **Peak** | **Fewest** | **Best** |
| New York | 12:00–21:00 | High | Fewer | Yes |

For 24/7 crypto the structural clock matters more than the session clock:

| Event | When (UTC) |
|---|---|
| Funding settlement | 00:00, 08:00, 16:00 |
| CME weekend gap | Fri 22:00 → Sun 23:00 |
| Quarterly expiry | Last Friday of Mar/Jun/Sep/Dec, 08:00 |

## Risks

Convergence guarantees solvency **at expiry**. It guarantees nothing about the
path there.

| Risk | Mechanism |
|---|---|
| **Liquidation** | Spot rallies, short futures leg exhausts margin, forced close. The spot gain is unrealised; the futures loss is real. **The dominant failure mode.** |
| **Counterparty** | One venue holds both legs |
| **Fee drag** | Round-trip fees routinely exceed the entire basis |
| **Funding cost** | Capital cost above the basis means paying to work |
| **Stale fees** | `fees.py` defaults are base-tier snapshots — verify against your account |

`safety_check()` flags any configuration whose liquidation buffer is under 25%.

### Collateral drag

The basis is earned on *notional*, but margin posted against the short leg earns
nothing while it sits there. Return on capital is therefore always lower than the
headline basis, by a factor of `(1 + margin_ratio)`. At 2x, roughly a third of the
return is given up to idle collateral. `expected_profit()` reports this explicitly
so the headline number is never mistaken for what lands in the account.

## Scope

**Analysis and monitoring only. This package places no orders and needs no API
keys.** Live execution is a later step requiring keys, testnet validation, and a
deliberate decision to risk capital. Do not skip that sequencing.

## Roadmap

- [x] Basis maths, fee model, liquidation distance
- [x] Session and structural-clock awareness
- [x] Multi-venue scanner with honest rejection
- [x] Profit projection net of collateral drag
- [x] Manual quote entry for use without API access
- [x] Local premium monitor with persistence gating
- [x] Pairs screen with two-leg cost gate
- [x] Shared append-only JSONL history
- [x] Test suite (73 tests, stdlib `unittest`)
- [ ] Historical basis backtest — does the edge persist across regimes?
- [ ] Bybit and Deribit adapters
- [ ] Alerting when the basis crosses a threshold
- [ ] Testnet execution with both legs filled atomically
