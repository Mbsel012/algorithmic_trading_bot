# Basis Arbitrage Toolkit

Dated-futures cash-and-carry: buy spot, sell the dated future, hold to expiry.

This is the one form of **true arbitrage** reachable without colocation or
exchange-member fee tiers. At expiry the future settles to spot by contract
specification, so convergence is contractual rather than probabilistic and the
return is known at entry. The binding constraint is capital, not speed — which
is precisely the constraint an individual can supply.

## Quick start

No API keys, no third-party packages. Python 3.9+ and `requests` only.

```bash
python -m arbitrage.cli --demo      # synthetic quotes, no network
python -m arbitrage.cli --clock     # timing report only
python -m arbitrage.cli --base BTC  # live public market data
python -m unittest discover -s arbitrage -t .
```

## What it does

| Module | Responsibility |
|---|---|
| `basis.py` | Basis maths, annualisation, sizing, liquidation distance |
| `fees.py` | Per-venue taker schedules and round-trip cost |
| `sessions.py` | Session windows, funding times, CME gap, quarterly expiry |
| `venues.py` | Public REST adapters (Binance, OKX) |
| `scanner.py` | Costing, ranking, safety check, report rendering |
| `cli.py` | Command-line entry point |

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

## Scope

**Analysis and monitoring only. This package places no orders and needs no API
keys.** Live execution is a later step requiring keys, testnet validation, and a
deliberate decision to risk capital. Do not skip that sequencing.

## Roadmap

- [x] Basis maths, fee model, liquidation distance
- [x] Session and structural-clock awareness
- [x] Multi-venue scanner with honest rejection
- [x] Test suite (31 tests, stdlib `unittest`)
- [ ] Historical basis backtest — does the edge persist across regimes?
- [ ] Bybit and Deribit adapters
- [ ] Alerting when the basis crosses a threshold
- [ ] Testnet execution with both legs filled atomically
