import { Injectable, NotFoundException } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { LlmService } from '../llm/llm.service';
import { languageDirective } from '../common/lang.util';
import type { CardDoc, LearningGoalDoc } from '../domain/types';

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class LearningService {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly llm: LlmService,
  ) {}

  private goals() {
    return this.persistence.getRepo<LearningGoalDoc>('learning_goals');
  }
  private cards() {
    return this.persistence.getRepo<CardDoc>('learning_cards');
  }

  async listGoals(userId: string) {
    const [goals, cards] = await Promise.all([
      this.goals().findByUser(userId),
      this.cards().findByUser(userId),
    ]);
    const now = Date.now();
    return goals.map((g) => {
      const mine = cards.filter((c) => c.goalId === g._id);
      return {
        _id: g._id,
        topic: g.topic,
        total: mine.length,
        due: mine.filter((c) => new Date(c.dueAt).getTime() <= now).length,
      };
    });
  }

  async dueCards(userId: string, goalId?: string): Promise<CardDoc[]> {
    const now = Date.now();
    const all = await this.cards().findByUser(userId);
    return all
      .filter((c) => (goalId ? c.goalId === goalId : true))
      .filter((c) => new Date(c.dueAt).getTime() <= now)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }

  async countDue(userId: string): Promise<number> {
    return (await this.dueCards(userId)).length;
  }

  // Create a goal; with Gemini, auto-generate a few starter flashcards.
  async createGoal(userId: string, topic: string, lang = 'en') {
    const goal = await this.goals().insert({ userId, topic: topic.trim() });
    if (this.llm.live) {
      const cards = await this.generateCards(topic, lang);
      for (const c of cards) await this.addCard(userId, goal._id, c.front, c.back);
    }
    return goal;
  }

  async addCard(userId: string, goalId: string, front: string, back: string) {
    return this.cards().insert({
      userId,
      goalId,
      front: front.trim(),
      back: back.trim(),
      dueAt: new Date().toISOString(), // due immediately for first review
      intervalDays: 0,
      reps: 0,
      lapses: 0,
    });
  }

  // Spaced repetition (SM-2-lite): "again" resets and reschedules soon; "good"
  // grows the interval (1 → 3 → 7 → …) so reviews land just before you'd forget.
  async review(userId: string, cardId: string, grade: 'again' | 'good') {
    const card = await this.cards().findOne({ _id: cardId, userId });
    if (!card) throw new NotFoundException('Card not found');

    let { intervalDays, reps, lapses } = card;
    if (grade === 'again') {
      reps = 0;
      intervalDays = 0;
      lapses += 1;
      const dueAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // ~10 min
      return this.cards().update(cardId, { reps, intervalDays, lapses, dueAt });
    }
    reps += 1;
    intervalDays = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(intervalDays * 2.3);
    const dueAt = new Date(Date.now() + intervalDays * DAY).toISOString();
    return this.cards().update(cardId, { reps, intervalDays, dueAt });
  }

  private async generateCards(topic: string, lang: string) {
    try {
      const raw = await this.llm.generate(
        `Create 5 concise flashcards to learn "${topic}". Reply ONLY with JSON: [{"front":"…","back":"…"}]. Keep each side short.${languageDirective(lang) ? ' ' + languageDirective(lang) : ''}`,
        'You are Pulse, a learning coach. Output only JSON.',
      );
      const arr = JSON.parse(raw.replace(/```json|```/g, '').trim());
      return Array.isArray(arr)
        ? arr.filter((c) => c?.front && c?.back).slice(0, 8)
        : [];
    } catch {
      return [];
    }
  }
}
