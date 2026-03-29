import { useState } from 'react';
import { Bold, Italic, Underline, Highlighter, Palette, X, List, ListOrdered, Quote, Undo, Redo } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { cn } from '../lib/utils';

interface RichTextEditorModalProps {
  initialContent: string;
  onSave: (content: string) => void;
  onClose: () => void;
}

export function RichTextEditorModal({ initialContent, onSave, onClose }: RichTextEditorModalProps) {
  const [content, setContent] = useState(initialContent);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base focus:outline-none max-w-none min-h-[200px] p-4 bg-white border border-slate-200 rounded-lg',
      },
    },
  });

  if (!editor) {
    return null;
  }

  const handleSave = () => {
    onSave(content);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-800">编辑笔记</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-100 bg-white sticky top-0 z-10">
          <button 
            onClick={() => editor.chain().focus().toggleBold().run()} 
            className={cn("p-2 rounded-md transition-colors", editor.isActive('bold') ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100")}
            title="加粗"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button 
            onClick={() => editor.chain().focus().toggleItalic().run()} 
            className={cn("p-2 rounded-md transition-colors", editor.isActive('italic') ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100")}
            title="斜体"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button 
            onClick={() => editor.chain().focus().toggleStrike().run()} 
            className={cn("p-2 rounded-md transition-colors", editor.isActive('strike') ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100")}
            title="删除线"
          >
            <Underline className="w-4 h-4" />
          </button>
          
          <div className="w-px h-4 bg-slate-200 mx-1" />
          
          <button 
            onClick={() => editor.chain().focus().toggleBulletList().run()} 
            className={cn("p-2 rounded-md transition-colors", editor.isActive('bulletList') ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100")}
            title="无序列表"
          >
            <List className="w-4 h-4" />
          </button>
          <button 
            onClick={() => editor.chain().focus().toggleOrderedList().run()} 
            className={cn("p-2 rounded-md transition-colors", editor.isActive('orderedList') ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100")}
            title="有序列表"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button 
            onClick={() => editor.chain().focus().toggleBlockquote().run()} 
            className={cn("p-2 rounded-md transition-colors", editor.isActive('blockquote') ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100")}
            title="引用"
          >
            <Quote className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-200 mx-1" />

          <div className="relative group">
            <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1" title="字体颜色">
              <Palette className="w-4 h-4" />
            </button>
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 shadow-lg rounded-lg p-2 hidden group-hover:grid grid-cols-4 gap-1 z-20">
              {['#000000', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'].map(color => (
                <button
                  key={color}
                  onClick={() => editor.chain().focus().setColor(color).run()}
                  className="w-6 h-6 rounded-full border border-slate-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="relative group">
            <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1" title="背景高光">
              <Highlighter className="w-4 h-4" />
            </button>
            <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 shadow-lg rounded-lg p-2 hidden group-hover:grid grid-cols-4 gap-1 z-20">
              {['transparent', '#FEF08A', '#BFDBFE', '#BBF7D0', '#FECACA', '#E9D5FF', '#FBCFE8', '#E5E7EB'].map(color => (
                <button
                  key={color}
                  onClick={() => color === 'transparent' ? editor.chain().focus().unsetHighlight().run() : editor.chain().focus().toggleHighlight({ color }).run()}
                  className="w-6 h-6 rounded border border-slate-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color === 'transparent' ? '#fff' : color }}
                >
                  {color === 'transparent' && <span className="text-[10px] text-slate-400">无</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-4 bg-slate-200 mx-1" />

          <button 
            onClick={() => editor.chain().focus().undo().run()} 
            disabled={!editor.can().undo()}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
            title="撤销"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button 
            onClick={() => editor.chain().focus().redo().run()} 
            disabled={!editor.can().redo()}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
            title="重做"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
          <EditorContent editor={editor} />
        </div>

        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            取消
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors shadow-sm">
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
