import { Injectable } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import type { HealthRecordDoc, HealthKind } from '../domain/types';

export interface AddHealthInput {
  kind: HealthKind;
  name: string;
  value?: string;
  unit?: string;
  notes?: string;
  notedAt?: string;
}

@Injectable()
export class HealthCompanionService {
  constructor(private readonly persistence: PersistenceService) {}

  private repo() {
    return this.persistence.getRepo<HealthRecordDoc>('health_records');
  }

  async add(userId: string, input: AddHealthInput): Promise<HealthRecordDoc> {
    return this.repo().insert({
      userId,
      kind: input.kind,
      name: input.name.trim(),
      value: input.value?.trim() || undefined,
      unit: input.unit?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      notedAt: input.notedAt ?? new Date().toISOString(),
    });
  }

  async list(userId: string): Promise<HealthRecordDoc[]> {
    const all = await this.repo().findByUser(userId);
    return all.sort((a, b) => (b.notedAt ?? '').localeCompare(a.notedAt ?? ''));
  }

  // Dashboard: latest reading per vital, current meds, recent symptoms, and a
  // small trend per vital (so the user sees direction over time, vision §3.6).
  async summary(userId: string) {
    const all = await this.list(userId);

    const vitalsByName = new Map<string, HealthRecordDoc[]>();
    for (const r of all.filter((r) => r.kind === 'vital')) {
      const list = vitalsByName.get(r.name) ?? [];
      list.push(r);
      vitalsByName.set(r.name, list);
    }
    const vitals = [...vitalsByName.entries()].map(([name, recs]) => ({
      name,
      latest: recs[0].value,
      unit: recs[0].unit,
      notedAt: recs[0].notedAt,
      // oldest→newest values for a sparkline
      trend: recs
        .slice()
        .reverse()
        .map((r) => r.value)
        .filter(Boolean),
    }));

    const medications = all
      .filter((r) => r.kind === 'medication')
      .map((r) => ({ name: r.name, value: r.value, notes: r.notes, notedAt: r.notedAt }));

    const symptoms = all
      .filter((r) => r.kind === 'symptom')
      .slice(0, 8)
      .map((r) => ({ name: r.name, notes: r.notes, notedAt: r.notedAt }));

    return {
      counts: { total: all.length, vitals: vitals.length, medications: medications.length },
      vitals,
      medications,
      symptoms,
    };
  }
}
