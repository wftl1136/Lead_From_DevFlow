import fs from 'node:fs';
import path from 'node:path';
import { RawLead } from '../types.js';

interface StoredLeadRecord {
  id: string;
  source: string;
  title: string;
  url: string;
  seenAt: string;
  score?: number;
}

export class LeadDatabase {
  private filePath: string;
  private seenIds: Set<string> = new Set();
  private records: StoredLeadRecord[] = [];
  private readonly MAX_RECORDS = 5000;

  constructor(storageDir: string = './data') {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.filePath = path.join(storageDir, 'seen_leads.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.records = parsed;
          for (const item of parsed) {
            if (item && item.id) {
              this.seenIds.add(item.id);
            }
          }
        }
      }
    } catch (err) {
      console.error('[Database] Ошибка загрузки базы просмотренных заказов:', err);
      this.records = [];
      this.seenIds.clear();
    }
  }

  public save(): void {
    try {
      if (this.records.length > this.MAX_RECORDS) {
        this.records = this.records.slice(this.records.length - this.MAX_RECORDS);
        this.seenIds = new Set(this.records.map(r => r.id));
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.records, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Database] Ошибка сохранения базы:', err);
    }
  }

  public hasSeen(id: string): boolean {
    return this.seenIds.has(id);
  }

  public markSeen(lead: RawLead, score?: number): void {
    if (this.seenIds.has(lead.id)) return;

    this.seenIds.add(lead.id);
    this.records.push({
      id: lead.id,
      source: lead.source,
      title: lead.title,
      url: lead.url,
      seenAt: new Date().toISOString(),
      score
    });
    this.save();
  }

  public getStats(): { totalSeen: number } {
    return {
      totalSeen: this.seenIds.size
    };
  }
}

export const db = new LeadDatabase();
