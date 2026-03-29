import { useLiveQuery } from 'dexie-react-hooks';
import { db, Category, Task } from '../db';
import { TaskRow } from './TaskRow';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
}

const DEFAULT_COLUMNS = [
  { id: 'actions', name: '操作', width: 100, minWidth: 80 },
  { id: 'title', name: '事项', width: 200, minWidth: 100 },
  { id: 'date', name: '日期', width: 120, minWidth: 100 },
  { id: 'status', name: '状态', width: 100, minWidth: 80 },
  { id: 'audio', name: '录音', width: 200, minWidth: 150 },
  { id: 'shortNote', name: '短注', width: 200, minWidth: 100 },
  { id: 'notes', name: '笔记', width: 200, minWidth: 100 },
  { id: 'attachments', name: '附件', width: 150, minWidth: 100 },
];

export function TaskTable({ filter, categoryId, categories }: TaskTableProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  
  const resizingColRef = useRef<string | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingColRef.current) return;
      
      const colId = resizingColRef.current;
      const colIndex = columns.findIndex(c => c.id === colId);
      if (colIndex === -1) return;

      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(columns[colIndex].minWidth, startWidthRef.current + diff);

      setColumns(prev => {
        const next = [...prev];
        next[colIndex] = { ...next[colIndex], width: newWidth };
        return next;
      });
    };

    const handleMouseUp = () => {
      resizingColRef.current = null;
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [columns]);

  const handleResizeStart = (e: React.MouseEvent, colId: string, currentWidth: number) => {
    e.preventDefault();
    resizingColRef.current = colId;
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;
    document.body.style.cursor = 'col-resize';
  };

  const rawTasks = useLiveQuery(
    () => {
      let collection = db.tasks.orderBy('order');
      
      if (categoryId) {
        return collection.filter(t => t.categoryId === categoryId).toArray();
      }
      
      if (filter && filter !== 'all') {
        return collection.filter(t => t.status === filter).toArray();
      }
      
      return collection.toArray();
    },
    [filter, categoryId]
  );

  useEffect(() => {
    if (rawTasks) {
      setTasks(rawTasks);
    }
  }, [rawTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
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

  if (!rawTasks) return <div className="p-8 text-center text-slate-500">加载中...</div>;
  if (tasks.length === 0) return <div className="p-8 text-center text-slate-500">暂无事项</div>;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTaskIds(new Set(tasks.map(t => t.id)));
    } else {
      setSelectedTaskIds(new Set());
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedTaskIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTaskIds(newSet);
  };

  const handleBatchMove = async () => {
    if (selectedTaskIds.size === 0 || !targetCategoryId) return;
    
    await Promise.all(
      Array.from(selectedTaskIds).map((id: string) => db.tasks.update(id, { categoryId: targetCategoryId }))
    );
    
    setSelectedTaskIds(new Set());
    setIsBatchMode(false);
  };

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      {/* Batch Operations Bar */}
      {categoryId && (
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input 
              type="checkbox" 
              checked={isBatchMode}
              onChange={(e) => {
                setIsBatchMode(e.target.checked);
                if (!e.target.checked) setSelectedTaskIds(new Set());
              }}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            批量操作
          </label>
          
          {isBatchMode && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">已选 {selectedTaskIds.size} 项</span>
              <select 
                value={targetCategoryId}
                onChange={(e) => setTargetCategoryId(e.target.value)}
                className="text-sm border-slate-200 rounded-md py-1 px-2"
              >
                <option value="">移动到分类...</option>
                {categories.filter(c => c.id !== categoryId).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button 
                onClick={handleBatchMove}
                disabled={selectedTaskIds.size === 0 || !targetCategoryId}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md disabled:opacity-50 hover:bg-blue-700 transition-colors"
              >
                确认移动
              </button>
            </div>
          )}
        </div>
      )}

      <div className="min-w-max w-full">
        {/* Header */}
        <div 
          className="grid gap-4 p-3 border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 z-10"
          style={{ gridTemplateColumns: columns.map(c => `${c.width}px`).join(' ') }}
        >
          {columns.map((col, index) => (
            <div key={col.id} className="relative flex items-center">
              {col.id === 'actions' && isBatchMode && (
                <input 
                  type="checkbox" 
                  checked={selectedTaskIds.size === tasks.length && tasks.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
              )}
              <span className={col.id === 'actions' ? 'mx-auto' : ''}>{col.name}</span>
              
              {index < columns.length - 1 && col.id !== 'actions' && (
                <div 
                  className="absolute right-[-10px] top-0 bottom-0 w-5 cursor-col-resize group flex justify-center items-center z-20"
                  onMouseDown={(e) => handleResizeStart(e, col.id, col.width)}
                >
                  <div className="w-0.5 h-4 bg-slate-300 group-hover:bg-blue-500 rounded-full transition-colors" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Body */}
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
                  columns={columns}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
