import { Injectable } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { LlmService } from '../llm/llm.service';
import { StorageService } from '../storage/storage.service';
import type { DocumentDoc } from '../domain/types';

export interface CreateDocumentInput {
  title: string;
  category: DocumentDoc['category'];
  content?: string;
  tags?: string[];
  expiresAt?: string;
  // optional attached photo/scan
  fileName?: string;
  mimeType?: string;
  base64?: string;
}

// Never send the embedding vector or the raw file bytes to the client.
function stripDoc(doc: DocumentDoc) {
  const { embedding, fileData, ...rest } = doc;
  return rest;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly llm: LlmService,
    private readonly storage: StorageService,
  ) {}

  private repo() {
    return this.persistence.getRepo<DocumentDoc>('documents');
  }

  async create(userId: string, input: CreateDocumentInput) {
    let content = (input.content ?? '').trim();
    const fileFields: Partial<DocumentDoc> = {};

    if (input.base64) {
      // Try to read the document with vision OCR (live mode only).
      if ((input.mimeType ?? '').startsWith('image/')) {
        const ocr = await this.llm.ocrImage(input.base64, input.mimeType!);
        if (ocr) content = content ? `${content}\n\n${ocr}` : ocr;
      }
      if (!content) {
        content = `Scanned document: ${input.fileName ?? 'attachment'} (automatic text extraction available once Gemini is connected).`;
      }
      fileFields.hasFile = true;
      fileFields.fileName = input.fileName;
      fileFields.fileMime = input.mimeType;
      // Production: store bytes in Cloud Storage. Demo: inline base64 in Mongo.
      if (this.storage.configured) {
        fileFields.fileKey = await this.storage.uploadBase64(
          userId,
          input.fileName ?? 'attachment',
          input.mimeType ?? 'application/octet-stream',
          input.base64,
        );
      } else {
        fileFields.fileData = input.base64;
      }
    }

    const embedding = await this.llm.embed(
      `${input.title} ${content} ${(input.tags ?? []).join(' ')}`,
    );

    const created = await this.repo().insert({
      userId,
      title: input.title,
      category: input.category,
      content,
      tags: input.tags ?? [],
      expiresAt: input.expiresAt,
      embedding,
      embedModel: this.llm.embedSignature,
      ...fileFields,
    });
    return stripDoc(created);
  }

  async list(userId: string) {
    const docs = await this.repo().findByUser(userId);
    return docs.map(stripDoc).sort((a, b) => (a.title > b.title ? 1 : -1));
  }

  async search(userId: string, query: string, limit = 5) {
    if (!query?.trim()) return [];
    await this.healStaleEmbeddings(userId);
    const queryEmbedding = await this.llm.embed(query);
    const results = await this.repo().vectorSearch(userId, queryEmbedding, limit);
    return results.map((r) => ({
      ...stripDoc(r.doc),
      score: Number(r.score.toFixed(4)),
    }));
  }

  // Re-embed any docs whose vector came from a different embedder (e.g. seeded
  // with the offline stand-in, now that a real model is connected). Bounded —
  // documents are few — and runs once per doc, then they're consistent.
  private async healStaleEmbeddings(userId: string): Promise<void> {
    const sig = this.llm.embedSignature;
    const docs = await this.repo().findByUser(userId);
    const stale = docs.filter((d) => d.embedModel !== sig);
    for (const d of stale) {
      const embedding = await this.llm.embed(
        `${d.title} ${d.content} ${(d.tags ?? []).join(' ')}`,
      );
      await this.repo().update(d._id, { embedding, embedModel: sig });
    }
  }

  // File bytes for previewing an attached image — from Cloud Storage or inline.
  async getFile(userId: string, id: string) {
    const doc = await this.repo().findOne({ _id: id, userId });
    if (!doc || !doc.hasFile) return null;
    let base64: string | undefined = doc.fileData;
    if (!base64 && doc.fileKey && this.storage.configured) {
      base64 = await this.storage.downloadBase64(doc.fileKey);
    }
    if (!base64) return null;
    return { fileName: doc.fileName, fileMime: doc.fileMime, base64 };
  }
}
