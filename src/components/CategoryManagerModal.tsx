import { useState } from 'react';
import { db, Category } from '../db';
import { X, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface CategoryManagerModalProps {
  categories: Category[];
  onClose: () => void;
}

export function CategoryManagerModal({ categories, onClose }: CategoryManagerModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');

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

        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex gap-2">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border-0 p-0"
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新分类名称..."
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
              {editingId === cat.id ? (
                <>
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                  />
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 text-sm border border-slate-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20"
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate(cat.id)}
                  />
                  <button onClick={() => handleUpdate(cat.id)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-100 p-1 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 text-sm font-medium text-slate-700">{cat.name}</span>
                  <button 
                    onClick={() => {
                      setEditingId(cat.id);
                      setEditName(cat.name);
                      setEditColor(cat.color);
                    }} 
                    className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(cat.id)} 
                    className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ))}
          {categories.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">暂无分类</div>
          )}
        </div>
      </div>
    </div>
  );
}
