import { useLiveQuery } from 'dexie-react-hooks';
import { db, Category, Task } from '../db';
import { TaskRow } from './TaskRow';
import { ColumnManagerModal } from './ColumnManagerModal';
import { cn } from '../lib/utils';
import {
  Menu,
  ChevronDown,
  ChevronUp,
  Filter,
  X as XIcon,
  Check,
  Search,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowUpDown,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import React, { useState, useEffect, useRef } from 'react';

interface TaskTableProps {
  filter?: 'all' | 'todo' | 'in-progress' | 'blocked' | 'done';
  categoryId?: string | null;
  categories: Category[];
  isBatchMode?: boolean;
  selectedTaskIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
}

const DEFAULT_COLUMNS = [
  { id: 'status', name: '状态', width: 100, minWidth: 80, visible: true },
  { id: 'title', name: '事项', width: 200, minWidth: 100, visible: true },
  { id: 'date', name: '日期', width: 120, minWidth: 100, visible: true },
  { id: 'audio', name: '录音', width: 32, minWidth: 28, visible: true },
  { id: 'shortNote', name: '短注', width: 200, minWidth: 100, visible: true },
  { id: 'notes', name: '笔记', width: 200, minWidth: 100, visible: true },
  { id: 'attachments', name: '附件', width: 150, minWidth: 100, visible: true },
];

export function TaskTable({ 
  filter, 
  categoryId, 
  categories,
  isBatchMode = false,
  selectedTaskIds = new Set(),
  onToggleSelection,
  onSelectAll
}: TaskTableProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('task-table-columns');
    if (saved) {
      let parsed = JSON.parse(saved);
      
      // 1. Rename 'actions' to 'status' if it exists and reduce width
      parsed = parsed.map((col: any) => {
        if (col.id === 'actions' || col.id === 'status') {
          return { ...col, id: 'status', name: '状态', width: Math.min(col.width || 80, 80), minWidth: 60 };
        }
        return col;
      });

      // 2. Remove duplicates (if both 'actions' and 'status' existed)
      const seen = new Set();
      parsed = parsed.filter((col: any) => {
        if (seen.has(col.id)) return false;
        seen.add(col.id);
        return true;
      });

      // 3. Ensure 'status' is in the list (if somehow it was missing)
      if (!seen.has('status')) {
        parsed.unshift({ id: 'status', name: '状态', width: 100, minWidth: 80, visible: true });
      }

      // 4. Force 'status' to be visible and cap 'audio' width
      return parsed.map((col: any) => {
        if (col.id === 'status') return { ...col, visible: true };
        if (col.id === 'audio') return { ...col, width: Math.min(col.width, 32), minWidth: 28 };
        return col;
      });
    }
    return DEFAULT_COLUMNS;
  });
  const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'manual' | 'date-desc' | 'date-asc'>('manual');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch all available tags for the current category (or all if no category)
  const allAvailableTags = useLiveQuery(async () => {
    let collection = db.tasks;
    const tasks = categoryId 
      ? await collection.where('categoryId').equals(categoryId).toArray()
      : await collection.toArray();
    const tags = new Set<string>();
    tasks.forEach(t => t.tags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [categoryId]);
  
  const resizingColRef = useRef<string | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!resizingColRef.current) return;
      
      // Prevent scrolling on mobile while resizing
      if (e.cancelable) {
        e.preventDefault();
      }
      
      const colId = resizingColRef.current;
      const colIndex = columns.findIndex(c => c.id === colId);
      if (colIndex === -1) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const diff = clientX - startXRef.current;
      const newWidth = Math.max(columns[colIndex].minWidth, startWidthRef.current + diff);

      setColumns(prev => {
        const next = [...prev];
        next[colIndex] = { ...next[colIndex], width: newWidth };
        return next;
      });
    };

    const handleEnd = () => {
      resizingColRef.current = null;
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [columns]);

  useEffect(() => {
    localStorage.setItem('task-table-columns', JSON.stringify(columns));
  }, [columns]);

  // Ensure status column is visible and correctly named
  useEffect(() => {
    const hasStatus = columns.some(c => c.id === 'status');
    const statusVisible = columns.find(c => c.id === 'status')?.visible;
    
    if (!hasStatus || !statusVisible) {
      setColumns(prev => {
        let next = [...prev];
        const statusIdx = next.findIndex(c => c.id === 'status' || c.id === 'actions');
        if (statusIdx !== -1) {
          next[statusIdx] = { ...next[statusIdx], id: 'status', name: '状态', visible: true };
        } else {
          next.unshift({ id: 'status', name: '状态', width: 80, minWidth: 60, visible: true });
        }
        return next;
      });
    }
  }, []);

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, colId: string, currentWidth: number) => {
    // Prevent scrolling while resizing on touch
    if ('touches' in e) {
      // We don't call preventDefault here because it might block other things, 
      // but we store the start position
      startXRef.current = e.touches[0].clientX;
    } else {
      e.preventDefault();
      startXRef.current = e.clientX;
    }
    
    resizingColRef.current = colId;
    startWidthRef.current = currentWidth;
    document.body.style.cursor = 'col-resize';
  };

  const rawTasks = useLiveQuery(
    async () => {
      let arr = await db.tasks.orderBy('order').toArray();
      
      if (categoryId) {
        arr = arr.filter(t => t.categoryId === categoryId);
      } else if (filter && filter !== 'all') {
        arr = arr.filter(t => t.status === filter);
      }
      
      if (selectedTags.length > 0) {
        arr = arr.filter(t => 
          selectedTags.some(tag => t.tags?.includes(tag))
        );
      }
      
      if (selectedStatuses.length > 0) {
        arr = arr.filter(t => selectedStatuses.includes(t.status));
      }
      
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        arr = arr.filter(t => 
          t.title.toLowerCase().includes(kw) || 
          t.shortNote?.toLowerCase().includes(kw) ||
          t.notes?.toLowerCase().includes(kw)
        );
      }
      
      if (sortOrder === 'date-asc') {
        arr.sort((a, b) => {
          const dateA = (a.date || '9999-99-99') + 'T' + (a.time || '99:99');
          const dateB = (b.date || '9999-99-99') + 'T' + (b.time || '99:99');
          return dateA.localeCompare(dateB);
        });
      } else if (sortOrder === 'date-desc') {
        arr.sort((a, b) => {
          const dateA = (a.date || '') + 'T' + (a.time || '');
          const dateB = (b.date || '') + 'T' + (b.time || '');
          return dateB.localeCompare(dateA);
        });
      }
      
      return arr;
    },
    [filter, categoryId, selectedTags, selectedStatuses, sortOrder, searchKeyword]
  );

  useEffect(() => {
    if (rawTasks) {
      setTasks(rawTasks);
    }
  }, [rawTasks]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over.id);

      const newTasks = arrayMove(tasks, oldIndex, newIndex) as Task[];
      setTasks(newTasks);

      // Update order in DB
      await Promise.all(
        newTasks.map((task: Task, index: number) => db.tasks.update(task.id, { order: index }))
      );
    }
  };

  const isLoading = !rawTasks;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSelectAll) {
      if (e.target.checked) {
        onSelectAll(tasks.map(t => t.id));
      } else {
        onSelectAll([]);
      }
    }
  };

  const toggleSelection = (id: string) => {
    if (onToggleSelection) {
      onToggleSelection(id);
    }
  };

  const handleBatchMove = async () => {
    if (selectedTaskIds.size === 0 || !targetCategoryId) return;
    
    await Promise.all(
      Array.from(selectedTaskIds).map((id: string) => db.tasks.update(id, { categoryId: targetCategoryId }))
    );
    
    if (onSelectAll) onSelectAll([]);
  };

  const handleBatchCopy = async () => {
    if (selectedTaskIds.size === 0 || !targetCategoryId) return;
    
    const tasksToCopy = tasks.filter(t => selectedTaskIds.has(t.id));
    const newTasks = tasksToCopy.map(t => ({
      ...t,
      id: crypto.randomUUID(),
      categoryId: targetCategoryId,
      order: Date.now() + Math.random()
    }));
    
    await db.tasks.bulkAdd(newTasks);
    if (onSelectAll) onSelectAll([]);
  };

  const handleBatchDelete = async () => {
    if (selectedTaskIds.size === 0) return;
    if (window.confirm(`确定删除选中的 ${selectedTaskIds.size} 个事项吗？`)) {
      await Promise.all(
        Array.from(selectedTaskIds).map((id: string) => db.tasks.delete(id))
      );
      if (onSelectAll) onSelectAll([]);
    }
  };

  const visibleColumns = columns.filter((c: any) => c.visible !== false);

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      {/* Batch Move Bar */}
      {isBatchMode && (
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-medium">操作:</span>
            <select 
              value={targetCategoryId}
              onChange={(e) => setTargetCategoryId(e.target.value)}
              className="text-sm border-slate-300 rounded-md py-1 px-2 focus:ring-2 focus:ring-blue-500 outline-none max-w-[120px]"
            >
              <option value="">选择目标分类...</option>
              {categories.filter(c => c.id !== categoryId).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button 
              onClick={handleBatchMove}
              disabled={selectedTaskIds.size === 0 || !targetCategoryId}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md disabled:opacity-50 hover:bg-blue-700 transition-colors font-bold shadow-sm whitespace-nowrap"
            >
              移动
            </button>
            <button 
              onClick={handleBatchCopy}
              disabled={selectedTaskIds.size === 0 || !targetCategoryId}
              className="text-sm bg-green-600 text-white px-3 py-1 rounded-md disabled:opacity-50 hover:bg-green-700 transition-colors font-bold shadow-sm whitespace-nowrap"
            >
              复制
            </button>
            <button 
              onClick={handleBatchDelete}
              disabled={selectedTaskIds.size === 0}
              className="text-sm bg-red-600 text-white px-3 py-1 rounded-md disabled:opacity-50 hover:bg-red-700 transition-colors font-bold shadow-sm whitespace-nowrap ml-auto"
            >
              删除
            </button>
          </div>
        </div>
      )}

      <div className="min-w-max w-full">
        {/* Header */}
        <div 
          className="grid gap-4 p-3 border-b-2 border-slate-300 bg-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider sticky top-0 z-40"
          style={{ gridTemplateColumns: visibleColumns.map((c: any) => `${c.width}px`).join(' ') }}
        >
          {visibleColumns.map((col: any, index: number) => (
            <div key={col.id} className="relative flex items-center">
              {col.id === 'status' && index === 0 && (
                <div className="flex items-center gap-2 mr-2">
                  <button 
                    onClick={() => setIsColumnManagerOpen(true)}
                    className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition-colors"
                    title="管理功能列"
                  >
                    <Menu className="w-4 h-4" />
                  </button>
                  {isBatchMode && (
                    <input 
                      type="checkbox" 
                      checked={selectedTaskIds.size === tasks.length && tasks.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                    />
                  )}
                </div>
              )}
              {col.id === 'title' && (
                <div className="flex items-center gap-1 w-full">
                  <div className="relative flex-1 min-w-0">
                    {isSearchOpen ? (
                      <div className="flex items-center bg-white rounded border border-blue-300 px-1.5 py-0.5 w-full">
                        <Search className="w-3 h-3 text-blue-500 shrink-0" />
                        <input
                          ref={searchInputRef}
                          autoFocus
                          type="text"
                          value={searchKeyword}
                          onChange={(e) => setSearchKeyword(e.target.value)}
                          placeholder="搜索..."
                          className="w-full bg-transparent border-none outline-none text-[10px] px-1 lowercase"
                          onBlur={() => {
                            if (!searchKeyword) setIsSearchOpen(false);
                          }}
                        />
                        <button onClick={() => { setSearchKeyword(''); setIsSearchOpen(false); }} className="text-slate-400 hover:text-slate-600">
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="truncate">{col.name}</span>
                        <button 
                          onClick={() => setIsSearchOpen(true)}
                          className={cn(
                            "p-1 rounded hover:bg-white transition-colors",
                            searchKeyword ? "text-blue-600 bg-blue-50" : "text-slate-500"
                          )}
                          title="搜索事项"
                        >
                          <Search className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="relative shrink-0">
                    <button 
                      onClick={() => setIsTagFilterOpen(!isTagFilterOpen)}
                      className={cn(
                        "p-1 rounded hover:bg-white transition-colors",
                        selectedTags.length > 0 ? "text-blue-600 bg-blue-50" : "text-slate-500"
                      )}
                      title="按标签筛选"
                    >
                      <ChevronDown className="w-3 h-3 fill-current" />
                    </button>
                  {isTagFilterOpen && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-2 min-w-[160px]">
                      <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">筛选标签 ({selectedTags.length})</span>
                        <button onClick={() => setIsTagFilterOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                        <button 
                          onClick={() => { setSelectedTags([]); setIsTagFilterOpen(false); }}
                          className={cn(
                            "text-left px-2 py-1.5 rounded text-[11px] hover:bg-slate-100 transition-colors flex items-center gap-2",
                            selectedTags.length === 0 && "bg-blue-50 text-blue-700 font-bold"
                          )}
                        >
                          {selectedTags.length === 0 && <Check className="w-3 h-3" />}
                          全部事项
                        </button>
                        {allAvailableTags?.map(tag => {
                          const isSelected = selectedTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedTags(selectedTags.filter(t => t !== tag));
                                } else {
                                  setSelectedTags([...selectedTags, tag]);
                                }
                              }}
                              className={cn(
                                "text-left px-2 py-1.5 rounded text-[11px] hover:bg-slate-100 transition-colors flex items-center gap-2 truncate",
                                isSelected && "bg-blue-50 text-blue-700 font-bold"
                              )}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                              #{tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {col.id === 'status' && (
              <div className="flex items-center gap-1 mx-auto">
                <span className="truncate">{col.name}</span>
                <div className="relative">
                  <button 
                    onClick={() => setIsStatusFilterOpen(!isStatusFilterOpen)}
                    className={cn(
                      "p-1 rounded hover:bg-white transition-colors",
                      selectedStatuses.length > 0 ? "text-blue-600 bg-blue-50" : "text-slate-500"
                    )}
                    title="按状态筛选"
                  >
                    <ChevronDown className="w-3 h-3 fill-current" />
                  </button>
                  {isStatusFilterOpen && (
                    <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-2 min-w-[120px]">
                      <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">筛选状态</span>
                        <button onClick={() => setIsStatusFilterOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button 
                          onClick={() => { setSelectedStatuses([]); setIsStatusFilterOpen(false); }}
                          className={cn(
                            "text-left px-2 py-1.5 rounded text-[11px] hover:bg-slate-100 transition-colors flex items-center gap-2",
                            selectedStatuses.length === 0 && "bg-blue-50 text-blue-700 font-bold"
                          )}
                        >
                          {selectedStatuses.length === 0 && <Check className="w-3 h-3" />}
                          全部状态
                        </button>
                        {['todo', 'in-progress', 'blocked', 'done'].map(status => {
                          const isSelected = selectedStatuses.includes(status);
                          const labels: Record<string, string> = {
                            'todo': '待开始',
                            'in-progress': '进行中',
                            'blocked': '受阻',
                            'done': '已完成'
                          };
                          return (
                            <button
                              key={status}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedStatuses(selectedStatuses.filter(t => t !== status));
                                } else {
                                  setSelectedStatuses([...selectedStatuses, status]);
                                }
                              }}
                              className={cn(
                                "text-left px-2 py-1.5 rounded text-[11px] hover:bg-slate-100 transition-colors flex items-center gap-2",
                                isSelected && "bg-blue-50 text-blue-700 font-bold"
                              )}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                              {labels[status]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
              
              {col.id === 'date' && (
                <button
                  onClick={() => {
                    if (sortOrder === 'manual') setSortOrder('date-desc');
                    else if (sortOrder === 'date-desc') setSortOrder('date-asc');
                    else setSortOrder('manual');
                  }}
                  className="mr-1 p-1 rounded hover:bg-white transition-colors text-slate-400 hover:text-blue-600"
                  title={sortOrder === 'manual' ? '当前：自定义排序。点击按由近到远排序' : sortOrder === 'date-desc' ? '当前：由近到远。点击按由远到近排序' : '当前：由远到近。点击恢复自定义排序'}
                >
                  {sortOrder === 'manual' && <ArrowUpDown className="w-3 h-3" />}
                  {sortOrder === 'date-desc' && <ArrowDownAZ className="w-3 h-3 text-blue-600" />}
                  {sortOrder === 'date-asc' && <ArrowUpAZ className="w-3 h-3 text-blue-600" />}
                </button>
              )}
              
              {col.id !== 'title' && col.id !== 'status' && (
                <span className={col.id === 'status' ? 'mx-auto' : ''}>{col.name}</span>
              )}
              
              {index < visibleColumns.length - 1 && col.id !== 'status' && (
                <div 
                  className="absolute right-[-10px] top-0 bottom-0 w-5 cursor-col-resize group flex justify-center items-center z-20"
                  onMouseDown={(e) => handleResizeStart(e, col.id, col.width)}
                  onTouchStart={(e) => handleResizeStart(e, col.id, col.width)}
                >
                  <div className="w-1 h-6 bg-slate-400 group-hover:bg-blue-600 rounded-full transition-colors border border-white shadow-sm" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">加载中...</div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center text-slate-500">暂无事项</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tasks.map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-slate-100">
                {tasks.map((task) => (
                  <TaskRow 
                    key={task.id} 
                    task={task} 
                    categories={categories} 
                    isBatchMode={isBatchMode}
                    isSelected={selectedTaskIds.has(task.id)}
                    onToggleSelection={() => toggleSelection(task.id)}
                    columns={visibleColumns}
                    currentCategoryId={categoryId}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {isColumnManagerOpen && (
        <ColumnManagerModal
          columns={columns}
          onSave={(newCols) => {
            setColumns(newCols);
            setIsColumnManagerOpen(false);
          }}
          onClose={() => setIsColumnManagerOpen(false)}
        />
      )}
    </div>
  );
}
