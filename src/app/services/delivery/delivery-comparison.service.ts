import { inject, Injectable, Signal, signal } from '@angular/core';
import { DELIVERY_PROVIDERS } from './delivery.tokens';
import { DeliveryProvider } from './delivery-provider.interface';
import {
  CreateDeliveryResult,
  defaultScoringStrategy,
  DeliveryComparisonOption,
  DeliveryQuote,
  DeliveryRequest,
  DeliveryScoringStrategy,
} from './delivery.types';

@Injectable({ providedIn: 'root' })
export class DeliveryComparisonService {
  private readonly providers =
    inject(DELIVERY_PROVIDERS, { optional: true }) ?? [];

  private readonly scoringStrategyState = signal<DeliveryScoringStrategy>(
    defaultScoringStrategy
  );

  setScoringStrategy(strategy: DeliveryScoringStrategy): void {
    this.scoringStrategyState.set(strategy);
  }

  scoringStrategy(): DeliveryScoringStrategy {
    return this.scoringStrategyState();
  }

  async getQuotes(request: DeliveryRequest): Promise<DeliveryQuote[]> {
    const results = await Promise.all(
      this.providers.map(async (provider) => {
        try {
          const quote = await provider.getQuote(request);
          return quote;
        } catch {
          return null;
        }
      })
    );
    return results.filter((q): q is DeliveryQuote => q !== null);
  }

  async getBestOption(
    request: DeliveryRequest
  ): Promise<DeliveryComparisonOption | null> {
    const quotes = await this.getQuotes(request);
    if (quotes.length === 0) return null;

    const score = this.scoringStrategy();
    const options: DeliveryComparisonOption[] = quotes.map((q) => ({
      ...q,
      score: score({ amountMinor: q.totalAmount, etaMinutes: q.etaMinutes }),
    }));

    options.sort((a, b) => b.score - a.score);
    return options[0] ?? null;
  }

  async createWithBestProvider(
    request: DeliveryRequest
  ): Promise<CreateDeliveryResult | null> {
    const best = await this.getBestOption(request);
    if (!best) return null;

    const provider = this.providers.find((p) => p.id === best.providerId);
    if (!provider) return null;

    return provider.createDelivery(request, best);
  }
}
