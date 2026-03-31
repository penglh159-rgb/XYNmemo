import { useEffect, useState, useRef } from 'react';
import { db, initDB, Category, Task } from './db';
import { useLiveQuery } from 'dexie-react-hooks';
import { LayoutGrid, ListTodo, Plus, Settings2, Download, Upload, AudioLines } from 'lucide-react';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const base64ToBlob = async (base64: string): Promise<Blob> => {
  const res = await fetch(base64);
  return await res.blob();
};
import { cn } from './lib/utils';
import { TaskTable } from './components/TaskTable';
import { CategoryManagerModal } from './components/CategoryManagerModal';

type ViewMode = 'overview' | 'category';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [overviewFilter, setOverviewFilter] = useState<'all' | 'todo' | 'in-progress' | 'blocked' | 'done'>('all');
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useLiveQuery(() => db.categories.toArray().then(cats => cats.sort((a, b) => (a.order || 0) - (b.order || 0)))) || [];

  useEffect(() => {
    initDB();
  }, []);

  const handleCreateTask = async (categoryId: string) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      categoryId,
      title: '新事项',
      date: '',
      status: 'todo',
      shortNote: '',
      notes: '',
      attachments: [],
      order: Date.now(),
    };
    await db.tasks.add(newTask);
  };

  useEffect(() => {
    setSelectedTaskIds(new Set());
  }, [viewMode, selectedCategoryId, overviewFilter]);

  const handleBatchDelete = async () => {
    if (selectedTaskIds.size === 0) return;
    if (window.confirm(`确定删除选中的 ${selectedTaskIds.size} 个事项吗？`)) {
      await db.tasks.bulkDelete(Array.from(selectedTaskIds));
      setSelectedTaskIds(new Set());
      setIsBatchMode(false);
    }
  };

  const handleBatchMoveCategory = async (newCategoryId: string) => {
    if (selectedTaskIds.size === 0) return;
    await Promise.all(
      Array.from(selectedTaskIds).map(id => db.tasks.update(id, { categoryId: newCategoryId }))
    );
    setSelectedTaskIds(new Set());
    setIsBatchMode(false);
  };

  const handleBackup = async () => {
    try {
      const tasks = await db.tasks.toArray();
      const categories = await db.categories.toArray();

      const processedTasks = await Promise.all(tasks.map(async (task) => {
        const processedTask: any = { ...task };
        if (task.audioBlob) {
          processedTask.audioBlob = await blobToBase64(task.audioBlob);
        }
        if (task.attachments && task.attachments.length > 0) {
          processedTask.attachments = await Promise.all(task.attachments.map(async (att) => ({
            ...att,
            data: await blobToBase64(att.data)
          })));
        }
        if (task.customFields) {
          processedTask.customFields = { ...task.customFields };
          for (const [key, value] of Object.entries(task.customFields)) {
            if (key.startsWith('audio_') && value instanceof Blob) {
              processedTask.customFields[key] = await blobToBase64(value);
            } else if (key.startsWith('attachments_') && Array.isArray(value)) {
              processedTask.customFields[key] = await Promise.all(value.map(async (att: any) => ({
                ...att,
                data: await blobToBase64(att.data)
              })));
            }
          }
        }
        return processedTask;
      }));

      const backupData = {
        tasks: processedTasks,
        categories,
        localStorage: {
          'task-table-columns': localStorage.getItem('task-table-columns')
        }
      };

      const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
      const filename = `vonote-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'application/json' })] })) {
        try {
          await navigator.share({
            files: [new File([blob], filename, { type: 'application/json' })],
            title: 'VoNote备份文件',
          });
          return;
        } catch (shareError) {
          console.log('Share failed or cancelled, falling back to download', shareError);
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Backup failed:', error);
      alert('备份失败，请查看控制台错误信息。');
    }
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const backupData = JSON.parse(content);

        if (!backupData.tasks || !backupData.categories) {
          throw new Error('无效的备份文件格式');
        }

        if (window.confirm('警告：恢复数据将覆盖当前所有数据！确定要继续吗？')) {
          const processedTasks = await Promise.all(backupData.tasks.map(async (task: any) => {
            const processedTask = { ...task };
            if (task.audioBlob) {
              processedTask.audioBlob = await base64ToBlob(task.audioBlob);
            }
            if (task.attachments && task.attachments.length > 0) {
              processedTask.attachments = await Promise.all(task.attachments.map(async (att: any) => ({
                ...att,
                data: await base64ToBlob(att.data)
              })));
            }
            if (task.customFields) {
              processedTask.customFields = { ...task.customFields };
              for (const [key, value] of Object.entries(task.customFields)) {
                if (key.startsWith('audio_') && typeof value === 'string') {
                  processedTask.customFields[key] = await base64ToBlob(value);
                } else if (key.startsWith('attachments_') && Array.isArray(value)) {
                  processedTask.customFields[key] = await Promise.all(value.map(async (att: any) => ({
                    ...att,
                    data: await base64ToBlob(att.data)
                  })));
                }
              }
            }
            return processedTask;
          }));

          await db.transaction('rw', db.tasks, db.categories, async () => {
            await db.tasks.clear();
            await db.categories.clear();
            await db.tasks.bulkAdd(processedTasks);
            await db.categories.bulkAdd(backupData.categories);
          });

          if (backupData.localStorage) {
            Object.entries(backupData.localStorage).forEach(([key, value]) => {
              if (value !== null && value !== undefined) {
                localStorage.setItem(key, value as string);
              }
            });
          }

          alert('数据恢复成功！页面将自动刷新。');
          window.location.reload();
        }
      } catch (error) {
        console.error('Restore failed:', error);
        alert('恢复失败：文件格式错误或数据损坏。');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b-2 border-slate-300 px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between sticky top-0 z-10 shadow-md overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pr-2">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-blue-700 flex items-center justify-center text-white font-bold shadow-sm text-xs sm:text-base">
            <AudioLines className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <h1 className="text-sm sm:text-lg font-bold tracking-tight text-slate-800 whitespace-nowrap">VoNote</h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={handleBackup}
              className="flex items-center gap-1 px-1.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-md transition-colors border-2 border-slate-300 shadow-sm active:scale-95"
              title="导出所有数据为 JSON"
            >
              <Download className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">备份</span>
            </button>
            <label
              className="flex items-center gap-1 px-1.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-md transition-colors border-2 border-slate-300 shadow-sm active:scale-95 cursor-pointer"
              title="从 JSON 恢复数据"
            >
              <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">恢复</span>
              <input
                type="file"
                accept=".json"
                ref={fileInputRef}
                onChange={handleRestore}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex bg-slate-300 p-0.5 sm:p-1 rounded-lg border-2 border-slate-400">
            <button
            onClick={() => setViewMode('overview')}
            className={cn(
              "px-2 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-sm font-bold rounded-md flex items-center gap-1 sm:gap-2 transition-all border-2 whitespace-nowrap",
              viewMode === 'overview' 
                ? "bg-blue-800 text-white border-blue-900 shadow-md" 
                : "text-slate-700 border-transparent hover:bg-slate-100"
            )}
          >
            <LayoutGrid className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">统合概览</span>
            <span className="sm:hidden">概览</span>
          </button>
          <button
            onClick={() => {
              setViewMode('category');
              if (!selectedCategoryId && categories.length > 0) {
                setSelectedCategoryId(categories[0].id);
              }
            }}
            className={cn(
              "px-2 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-sm font-bold rounded-md flex items-center gap-1 sm:gap-2 transition-all border-2 whitespace-nowrap",
              viewMode === 'category' 
                ? "bg-blue-800 text-white border-blue-900 shadow-md" 
                : "text-slate-700 border-transparent hover:bg-slate-100"
            )}
          >
            <ListTodo className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">分类详情</span>
            <span className="sm:hidden">分类</span>
          </button>
          <button
            onClick={() => setIsCategoryManagerOpen(true)}
            className="px-1.5 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-sm font-medium rounded-md flex items-center gap-1 sm:gap-2 transition-colors text-slate-700 hover:bg-slate-100"
            title="管理分类"
          >
            <Settings2 className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>
        </div>
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
                      "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border-2",
                      overviewFilter === filter
                        ? "bg-slate-900 text-white border-black shadow-md"
                        : "bg-white text-slate-800 border-slate-400 hover:border-slate-600 hover:bg-slate-50"
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

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (categories.length > 0) {
                      handleCreateTask(categories[0].id);
                    } else {
                      setIsCategoryManagerOpen(true);
                    }
                  }}
                  className="flex items-center justify-center bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-800 transition-all shadow-md border-2 border-blue-900 active:scale-95"
                >
                  +新事项
                </button>
                
                {!isBatchMode ? (
                  <button
                    onClick={() => setIsBatchMode(true)}
                    className="flex items-center justify-center bg-white text-blue-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all shadow-md border-2 border-blue-200 active:scale-95"
                  >
                    批量选中
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 bg-slate-200 px-3 py-1.5 rounded-lg border-2 border-slate-300">
                      已选中({selectedTaskIds.size})
                    </span>
                    <div className="relative group">
                      <button
                        disabled={selectedTaskIds.size === 0}
                        className="flex items-center justify-center bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md border-2 border-blue-800 active:scale-95"
                      >
                        移动到
                      </button>
                      <div className="absolute top-full left-0 mt-1 hidden group-hover:block z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-2 min-w-[150px]">
                        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          {categories.map(c => (
                            <button
                              key={c.id}
                              onClick={() => handleBatchMoveCategory(c.id)}
                              className="text-left px-2 py-1.5 rounded text-[11px] hover:bg-slate-100 transition-colors flex items-center gap-2"
                            >
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                              {c.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleBatchDelete}
                      disabled={selectedTaskIds.size === 0}
                      className="flex items-center justify-center bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-all shadow-md border-2 border-red-800 active:scale-95"
                    >
                      删除
                    </button>
                    <button
                      onClick={() => {
                        setIsBatchMode(false);
                        setSelectedTaskIds(new Set());
                      }}
                      className="flex items-center justify-center bg-white text-slate-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all shadow-md border-2 border-slate-200 active:scale-95"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-md border-2 border-slate-300 flex-1 overflow-hidden flex flex-col">
                <TaskTable 
                  filter={overviewFilter} 
                  categories={categories} 
                  isBatchMode={isBatchMode}
                  selectedTaskIds={selectedTaskIds}
                  onToggleSelection={(id) => {
                    const newSet = new Set(selectedTaskIds);
                    if (newSet.has(id)) newSet.delete(id);
                    else newSet.add(id);
                    setSelectedTaskIds(newSet);
                  }}
                  onSelectAll={(ids) => setSelectedTaskIds(new Set(ids))}
                />
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
                      "px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border-2",
                      selectedCategoryId === cat.id
                        ? "bg-blue-200 text-blue-900 border-blue-700 shadow-sm"
                        : "bg-white text-slate-700 border-slate-400 hover:border-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="bg-white rounded-xl shadow-md border-2 border-slate-300 flex-1 overflow-hidden flex flex-col">
                <div className="p-4 border-b-2 border-slate-300 flex justify-between items-center bg-slate-200">
                  <h2 className="font-bold text-slate-900 text-lg">
                    {categories.find(c => c.id === selectedCategoryId)?.name || '选择分类'}
                  </h2>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => selectedCategoryId && handleCreateTask(selectedCategoryId)}
                      disabled={!selectedCategoryId}
                      className="flex items-center justify-center text-xs bg-blue-700 text-white px-4 py-1.5 rounded-lg font-bold hover:bg-blue-800 disabled:opacity-50 transition-all shadow-md border-2 border-blue-900 active:scale-95"
                    >
                      +新事项
                    </button>
                    
                    {!isBatchMode ? (
                      <button
                        onClick={() => setIsBatchMode(true)}
                        className="flex items-center justify-center text-xs bg-white text-blue-600 px-4 py-1.5 rounded-lg font-bold hover:bg-blue-50 transition-all shadow-md border-2 border-blue-200 active:scale-95"
                      >
                        批量选中
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 bg-slate-200 px-3 py-1.5 rounded-lg border-2 border-slate-300">
                          已选中({selectedTaskIds.size})
                        </span>
                        <div className="relative group">
                          <button
                            disabled={selectedTaskIds.size === 0}
                            className="flex items-center justify-center text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md border-2 border-blue-800 active:scale-95"
                          >
                            移动到
                          </button>
                          <div className="absolute top-full right-0 mt-1 hidden group-hover:block z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-2 min-w-[150px]">
                            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                              {categories.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => handleBatchMoveCategory(c.id)}
                                  className="text-left px-2 py-1.5 rounded text-[11px] hover:bg-slate-100 transition-colors flex items-center gap-2"
                                >
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                                  {c.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={handleBatchDelete}
                          disabled={selectedTaskIds.size === 0}
                          className="flex items-center justify-center text-xs bg-red-600 text-white px-4 py-1.5 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 transition-all shadow-md border-2 border-red-800 active:scale-95"
                        >
                          删除
                        </button>
                        <button
                          onClick={() => {
                            setIsBatchMode(false);
                            setSelectedTaskIds(new Set());
                          }}
                          className="flex items-center justify-center text-xs bg-white text-slate-600 px-4 py-1.5 rounded-lg font-bold hover:bg-slate-50 transition-all shadow-md border-2 border-slate-200 active:scale-95"
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <TaskTable 
                  categoryId={selectedCategoryId} 
                  categories={categories} 
                  isBatchMode={isBatchMode}
                  selectedTaskIds={selectedTaskIds}
                  onToggleSelection={(id) => {
                    const newSet = new Set(selectedTaskIds);
                    if (newSet.has(id)) newSet.delete(id);
                    else newSet.add(id);
                    setSelectedTaskIds(newSet);
                  }}
                  onSelectAll={(ids) => setSelectedTaskIds(new Set(ids))}
                />
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
