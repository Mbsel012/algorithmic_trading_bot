"""
Basis arbitrage toolkit.

Implements the one form of *true* arbitrage that is structurally reachable
without colocation or exchange-member fee tiers: dated-futures cash-and-carry.

Buy spot, sell the dated future, hold to expiry. The future settles to spot by
contract specification, so convergence is contractual rather than probabilistic.
The return is known at entry; the binding constraint is capital, not speed.

This package deliberately stops at analysis and monitoring. Live order placement
is a separate, later step that requires API keys and testnet validation.
"""

__all__ = ["basis", "fees", "sessions", "venues", "scanner"]
