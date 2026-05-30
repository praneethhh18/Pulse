import { Injectable, NotFoundException } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { LlmService } from '../llm/llm.service';
import { languageDirective } from '../common/lang.util';
import type { PackItem, TripDoc } from '../domain/types';

@Injectable()
export class TravelService {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly llm: LlmService,
  ) {}

  private repo() {
    return this.persistence.getRepo<TripDoc>('trips');
  }

  list(userId: string) {
    return this.repo()
      .findByUser(userId)
      .then((t) => t.sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? '')));
  }

  async addTrip(
    userId: string,
    input: { destination: string; startsAt: string; endsAt?: string; notes?: string },
    lang = 'en',
  ) {
    const list = await this.buildPackingList(input.destination, input.startsAt, input.endsAt, lang);
    return this.repo().insert({
      userId,
      destination: input.destination.trim(),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      notes: input.notes?.trim() || undefined,
      packingList: list.map((label) => ({ label, packed: false })),
    });
  }

  async toggleItem(userId: string, tripId: string, index: number) {
    const trip = await this.repo().findOne({ _id: tripId, userId });
    if (!trip) throw new NotFoundException('Trip not found');
    const packingList = trip.packingList.map((it, i) =>
      i === index ? { ...it, packed: !it.packed } : it,
    );
    return this.repo().update(tripId, { packingList });
  }

  private async buildPackingList(
    destination: string,
    startsAt: string,
    endsAt: string | undefined,
    lang: string,
  ): Promise<string[]> {
    const days =
      endsAt && startsAt
        ? Math.max(1, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 86400000))
        : 3;
    if (this.llm.live) {
      try {
        const raw = await this.llm.generate(
          `Make a concise packing list (8-12 items) for a ${days}-day trip to ${destination}. Reply ONLY with a JSON array of short strings.${languageDirective(lang) ? ' ' + languageDirective(lang) : ''}`,
          'You are Pulse, a practical travel assistant. Output only a JSON array.',
        );
        const arr = JSON.parse(raw.replace(/```json|```/g, '').trim());
        if (Array.isArray(arr) && arr.length) return arr.map(String).slice(0, 14);
      } catch {
        /* fall through to template */
      }
    }
    // Deterministic starter list (demo).
    return [
      'ID / passport',
      'Phone + charger',
      'Power bank',
      `Clothes for ${days} day(s)`,
      'Toiletries',
      'Medications',
      'Travel documents / tickets',
      'Wallet & cards',
    ];
  }
}
