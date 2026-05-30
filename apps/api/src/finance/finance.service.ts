import { Injectable } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { spendByCategory } from '../common/finance.util';
import type { TransactionDoc } from '../domain/types';

export interface AddTransactionInput {
  amount: number;
  direction?: 'debit' | 'credit';
  category: string;
  merchant: string;
  occurredAt?: string;
  recurring?: boolean;
}

@Injectable()
export class FinanceService {
  constructor(private readonly persistence: PersistenceService) {}

  private repo() {
    return this.persistence.getRepo<TransactionDoc>('financial_transactions');
  }

  list(userId: string) {
    return this.repo()
      .findByUser(userId)
      .then((t) => t.sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? '')));
  }

  add(userId: string, input: AddTransactionInput) {
    return this.repo().insert({
      userId,
      amount: Math.abs(input.amount),
      direction: input.direction ?? 'debit',
      category: input.category.trim(),
      merchant: input.merchant.trim(),
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      recurring: input.recurring ?? false,
    });
  }

  // Last-30-days spend, by category, with month-over-month deltas + the
  // recurring subscriptions Pulse has spotted.
  async summary(userId: string) {
    const txns = await this.repo().findByUser(userId);
    const recent = spendByCategory(txns, 30, 0);
    const prior = spendByCategory(txns, 60, 30);

    const categories = [...recent.entries()]
      .map(([name, amount]) => {
        const last = prior.get(name) ?? 0;
        const deltaPct = last > 0 ? Math.round(((amount - last) / last) * 100) : null;
        return { name, amount: Math.round(amount), lastPeriod: Math.round(last), deltaPct };
      })
      .sort((a, b) => b.amount - a.amount);

    const total = categories.reduce((s, c) => s + c.amount, 0);

    // Recurring charges (dedup by merchant).
    const subsMap = new Map<string, { merchant: string; amount: number; category: string }>();
    for (const t of txns) {
      if (t.recurring && t.direction === 'debit' && !subsMap.has(t.merchant)) {
        subsMap.set(t.merchant, { merchant: t.merchant, amount: Math.round(t.amount), category: t.category });
      }
    }

    return {
      windowDays: 30,
      total,
      categories,
      subscriptions: [...subsMap.values()],
      topCategory: categories[0]?.name,
    };
  }
}
