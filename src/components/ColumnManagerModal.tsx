import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, GripVertical, Eye, EyeOff, Edit2, Plus, Trash2 } from 'lucide-react';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../lib/utils';

interface ColumnConfig {
  id: string;
  name: string;
  width: number;
  minWidth: number;
  visible?: boolean;
}

interface ColumnManagerModalProps {
  columns: ColumnConfig[];
  onSave: (columns: ColumnConfig[]) => void;
  onClose: () => void;
}

const AVAILABLE_OPTIONAL_COLUMNS = [
  { id: 'audio', name: '录音', width: 200, minWidth: 150 },
  { id: 'shortNote', name: '短注', width: 200, minWidth: 100 },
  { id: 'notes', name: '笔记', width: 200, minWidth: 100 },
  { id: 'attachments', name: '附件', width: 150, minWidth: 100 },
];

interface SortableItemProps {
  column: ColumnConfig;
  onToggleVisibility: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onRemove: (id: string) => void;
  isFixed?: boolean;
}

function SortableColumnItem({ column, onToggleVisibility, onRename, onRemove, isFixed }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, disabled: column.id === 'status' || column.id === 'actions' });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
  };

  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(column.name);

  const handleRename = () => {
    onRename(column.id, tempName);
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl mb-2 shadow-sm transition-all",
        isDragging && "shadow-lg ring-2 ring-blue-500/20 opacity-90",
        isFixed && "bg-slate-50 opacity-80"
      )}
    >
      {!(column.id === 'status' || column.id === 'actions') && (
        <button {...attributes} {...listeners} className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      
      <div className="flex-1 flex items-center gap-2">
        {isEditing ? (
          <input
            autoFocus
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            className="flex-1 text-sm border-b border-blue-500 outline-none px-1"
          />
        ) : (
          <span className="text-sm font-medium text-slate-700 flex-1 truncate">{column.name}</span>
        )}
        
        {!(column.id === 'status' || column.id === 'actions') && (
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1">
        {!isFixed && (
          <button
            onClick={() => onToggleVisibility(column.id)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              column.visible !== false ? "text-blue-600 bg-blue-50" : "text-slate-400 bg-slate-100"
            )}
            title={column.visible !== false ? "隐藏列" : "显示列"}
          >
            {column.visible !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        )}
        
        {!isFixed && (
          <button
            onClick={() => onRemove(column.id)}
            className="p-2 text-slate-400 hover:text-red-500 bg-slate-100 rounded-lg transition-colors"
            title="移除列"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function ColumnManagerModal({ columns, onSave, onClose }: ColumnManagerModalProps) {
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>(
    columns.map(c => ({ ...c, visible: c.visible ?? true }))
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalColumns((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleVisibility = (id: string) => {
    setLocalColumns(prev => prev.map(c => 
      c.id === id ? { ...c, visible: !c.visible } : c
    ));
  };

  const renameColumn = (id: string, newName: string) => {
    setLocalColumns(prev => prev.map(c => 
      c.id === id ? { ...c, name: newName } : c
    ));
  };

  const removeColumn = (id: string) => {
    setLocalColumns(prev => prev.filter(c => c.id !== id));
  };

  const addColumn = (col: typeof AVAILABLE_OPTIONAL_COLUMNS[0]) => {
    const existingCount = localColumns.filter(c => c.id.startsWith(col.id)).length;
    const newId = existingCount === 0 ? col.id : `${col.id}_${Date.now()}`;
    const newName = existingCount === 0 ? col.name : `${col.name}${existingCount + 1}`;
    setLocalColumns(prev => [...prev, { ...col, id: newId, name: newName, visible: true }]);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-800">管理功能列</h3>
            <p className="text-xs text-slate-500 mt-0.5">拖动排序，点击图标切换显示/隐藏</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
          <div className="mb-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">当前布局</h4>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localColumns.filter(c => c.id !== 'status' && c.id !== 'actions').map(c => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {localColumns.filter(c => c.id !== 'status' && c.id !== 'actions').map((col) => (
                  <SortableColumnItem
                    key={col.id}
                    column={col}
                    onToggleVisibility={toggleVisibility}
                    onRename={renameColumn}
                    onRemove={removeColumn}
                    isFixed={col.id === 'status' || col.id === 'actions' || col.id === 'title'}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">添加预设列</h4>
            
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_OPTIONAL_COLUMNS.map(col => {
                return (
                  <button
                    key={col.id}
                    onClick={() => addColumn(col)}
                    className="flex items-center justify-between p-3 rounded-xl border-2 transition-all text-sm font-medium bg-white border-slate-200 text-slate-700 hover:border-blue-500 hover:text-blue-600 shadow-sm"
                  >
                    {col.name}
                    <Plus className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
            取消
          </button>
          <button 
            onClick={() => onSave(localColumns)} 
            className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-md active:scale-95"
          >
            保存布局
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
