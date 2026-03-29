import { useEffect, useState } from 'react';
import { db, initDB, Category, Task } from './db';
import { useLiveQuery } from 'dexie-react-hooks';
import { LayoutGrid, ListTodo, Plus, Settings2 } from 'lucide-react';
import { cn } from './lib/utils';
import { TaskTable } from './components/TaskTable';
import { CategoryManagerModal } from './components/CategoryManagerModal';

type ViewMode = 'overview' | 'category';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [overviewFilter, setOverviewFilter] = useState<'all' | 'todo' | 'in-progress' | 'blocked' | 'done'>('all');
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  useEffect(() => {
    initDB();
  }, []);

  const handleCreateTask = async (categoryId: string) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      categoryId,
      title: '新事项',
      date: new Date().toISOString().split('T')[0],
      status: 'todo',
      shortNote: '',
      notes: '',
      attachments: [],
      order: Date.now(),
    };
    await db.tasks.add(newTask);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
            P
          </div>
          <h1 className="text-lg font-semibold tracking-tight">进度备忘</h1>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('overview')}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors",
              viewMode === 'overview' ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            统合概览
          </button>
          <button
            onClick={() => {
              setViewMode('category');
              if (!selectedCategoryId && categories.length > 0) {
                setSelectedCategoryId(categories[0].id);
              }
            }}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors",
              viewMode === 'category' ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <ListTodo className="w-4 h-4" />
            分类详情
          </button>
          <button
            onClick={() => setIsCategoryManagerOpen(true)}
            className="px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors text-slate-600 hover:text-slate-900"
            title="管理分类"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-x-auto p-4 md:p-6 flex flex-col">
        <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
          {viewMode === 'overview' ? (
            <div className="flex flex-col gap-4 flex-1">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {(['all', 'todo', 'in-progress', 'blocked', 'done'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setOverviewFilter(filter)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                      overviewFilter === filter
                        ? "bg-slate-800 text-white"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {filter === 'all' && '全部'}
                    {filter === 'todo' && '待办'}
                    {filter === 'in-progress' && '进行中'}
                    {filter === 'blocked' && '受阻'}
                    {filter === 'done' && '已完成'}
                  </button>
                ))}
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
                <TaskTable filter={overviewFilter} categories={categories} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 flex-1">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
                      selectedCategoryId === cat.id
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h2 className="font-medium text-slate-800">
                    {categories.find(c => c.id === selectedCategoryId)?.name || '选择分类'}
                  </h2>
                  <button
                    onClick={() => selectedCategoryId && handleCreateTask(selectedCategoryId)}
                    disabled={!selectedCategoryId}
                    className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    新建事项
                  </button>
                </div>
                <TaskTable categoryId={selectedCategoryId} categories={categories} />
              </div>
            </div>
          )}
        </div>
      </main>

      {isCategoryManagerOpen && (
        <CategoryManagerModal 
          categories={categories} 
          onClose={() => setIsCategoryManagerOpen(false)} 
        />
      )}
    </div>
  );
}
