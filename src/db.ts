import Dexie, { Table } from 'dexie';

export interface Category {
  id: string;
  name: string;
  color: string;
}

export type TaskStatus = 'todo' | 'in-progress' | 'blocked' | 'done';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: Blob;
}

export interface Task {
  id: string;
  categoryId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  status: TaskStatus;
  audioBlob?: Blob;
  shortNote: string;
  notes: string; // HTML string
  attachments: Attachment[];
  tags?: string[];
  order: number;
  blockedReason?: string;
}

export class ProgressMemoDB extends Dexie {
  tasks!: Table<Task, string>;
  categories!: Table<Category, string>;

  constructor() {
    super('ProgressMemoDB');
    this.version(1).stores({
      tasks: 'id, categoryId, date, status, order',
      categories: 'id, name'
    });
  }
}

export const db = new ProgressMemoDB();

export const initDB = async () => {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkAdd([
      { id: '1', name: '打卡', color: '#EF4444' },
      { id: '2', name: '外语学习', color: '#3B82F6' },
      { id: '3', name: '购物清单', color: '#10B981' },
      { id: '4', name: '长期事务', color: '#8B5CF6' }
    ]);
  }
};
