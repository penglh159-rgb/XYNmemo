import { useState } from 'react';
import { db, Category } from '../db';
import { X, Plus, Trash2, Edit2, Check, GripVertical } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  MouseSensor,
  TouchSensor,
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

interface CategoryManagerModalProps {
  categories: Category[];
  onClose: () => void;
}

function SortableCategoryItem({ 
  category, 
  editingId, 
  editName, 
  editColor, 
  setEditColor, 
  setEditName, 
  handleUpdate, 
  setEditingId, 
  handleDelete 
}: {
  category: Category;
  editingId: string | null;
  editName: string;
  editColor: string;
  setEditColor: (c: string) => void;
  setEditName: (n: string) => void;
  handleUpdate: (id: string) => void;
  setEditingId: (id: string | null) => void;
  handleDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg shadow-sm group",
        isDragging && "opacity-50 shadow-md border-blue-300"
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded touch-none shrink-0">
        <GripVertical className="w-5 h-5" />
      </div>
      
      {editingId === category.id ? (
        <>
          <div className="relative w-6 h-6 rounded-full overflow-hidden border-2 border-slate-300 shadow-sm shrink-0 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
            <input
              type="color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer border-0 p-0"
            />
          </div>
          <input
            autoFocus
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 min-w-0 text-sm border border-slate-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/20"
            onKeyDown={(e) => e.key === 'Enter' && handleUpdate(category.id)}
          />
          <button onClick={() => handleUpdate(category.id)} className="text-green-600 hover:bg-green-50 p-1.5 rounded-md transition-colors shrink-0">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-md transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <div
            className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm border border-slate-200"
            style={{ backgroundColor: category.color }}
          />
          <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-700">{category.name}</span>
          
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => {
                setEditingId(category.id);
                setEditName(category.name);
                setEditColor(category.color || '#3B82F6');
              }}
              className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-md transition-colors shrink-0"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(category.id)}
              className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-md transition-colors shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function CategoryManagerModal({ categories, onClose }: CategoryManagerModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
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
      const oldIndex = categories.findIndex((i) => i.id === active.id);
      const newIndex = categories.findIndex((i) => i.id === over.id);
      const newCategories = arrayMove(categories, oldIndex, newIndex);
      
      // Update order in database
      await Promise.all(
        newCategories.map((cat, index) => 
          db.categories.update(cat.id, { order: index })
        )
      );
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await db.categories.add({
      id: crypto.randomUUID(),
      name: newName.trim(),
      color: newColor
    });
    setNewName('');
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    await db.categories.update(id, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('确定删除该分类吗？该分类下的事项将保留但失去分类标签。')) {
      await db.categories.delete(id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800">管理分类</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex gap-2 items-center">
          <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-slate-300 shadow-sm shrink-0 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer border-0 p-0"
            />
          </div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新分类名称..."
            className="flex-1 min-w-0 text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="bg-blue-600 text-white p-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={categories.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {categories.map(cat => (
                <SortableCategoryItem
                  key={cat.id}
                  category={cat}
                  editingId={editingId}
                  editName={editName}
                  editColor={editColor}
                  setEditColor={setEditColor}
                  setEditName={setEditName}
                  handleUpdate={handleUpdate}
                  setEditingId={setEditingId}
                  handleDelete={handleDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
          {categories.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">暂无分类</div>
          )}
        </div>
      </div>
    </div>
  );
}
