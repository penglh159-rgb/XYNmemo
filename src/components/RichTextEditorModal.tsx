import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Italic, Underline as UnderlineIcon, Highlighter, Palette, X, List, ListOrdered, Quote, Undo, Redo, Save, Strikethrough, MoveDiagonal } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { cn } from '../lib/utils';

interface RichTextEditorModalProps {
  initialContent: string;
  onSave: (content: string) => void;
  onClose: () => void;
}

export function RichTextEditorModal({ initialContent, onSave, onClose }: RichTextEditorModalProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState({ bottom: 0, left: 0 });
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const highlightPickerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Underline,
      StarterKit.configure({
        history: {
          depth: 100,
          newGroupDelay: 500,
        },
      } as any),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base focus:outline-none max-w-none min-h-[200px] p-4 bg-white border border-slate-200 rounded-lg',
      },
    },
    autofocus: false,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showColorPicker && colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
      if (showHighlightPicker && highlightPickerRef.current && !highlightPickerRef.current.contains(event.target as Node)) {
        setShowHighlightPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker, showHighlightPicker]);

  if (!editor) {
    return null;
  }

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleSave = () => {
    onSave(editor.getHTML());
  };

  const [size, setSize] = useState({ 
    width: Math.min(672, window.innerWidth - 32), 
    height: window.innerHeight * (window.innerWidth < 640 ? 0.45 : 0.6) 
  });
  const isResizing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startPos.current = { x: clientX, y: clientY };
    startSize.current = { ...size };
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.addEventListener('touchmove', handleResizeMove, { passive: false });
    document.addEventListener('touchend', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent | TouchEvent) => {
    if (!isResizing.current) return;
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - startPos.current.x;
    const deltaY = clientY - startPos.current.y;
    
    setSize({
      width: Math.max(300, Math.min(window.innerWidth - 32, startSize.current.width - deltaX * 2)),
      height: Math.max(200, Math.min(window.innerHeight - 32, startSize.current.height + deltaY))
    });
  };

  const handleResizeEnd = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.removeEventListener('touchmove', handleResizeMove);
    document.removeEventListener('touchend', handleResizeEnd);
  };

  const handlePickerToggle = (e: React.MouseEvent, type: 'color' | 'highlight') => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Center the picker on the button, but keep it within screen bounds
    const centerX = rect.left + rect.width / 2;
    const safeX = Math.max(85, Math.min(window.innerWidth - 85, centerX));
    setPickerPos({ bottom: window.innerHeight - rect.top + 8, left: safeX });
    
    if (type === 'color') {
      setShowColorPicker(!showColorPicker);
      setShowHighlightPicker(false);
    } else {
      setShowHighlightPicker(!showHighlightPicker);
      setShowColorPicker(false);
    }
  };

  // Helper to prevent focus loss on mobile
  const preventDefault = (e: React.MouseEvent | React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-start justify-center p-2 sm:p-4 backdrop-blur-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col min-h-[30vh] max-h-[90vh] border border-slate-200 animate-in slide-in-from-top-4 duration-200 mt-0 sm:mt-10 overflow-hidden" style={{ width: size.width, height: size.height, minWidth: '300px', maxWidth: 'calc(100vw - 16px)' }}>
        <div className="flex items-center justify-between p-2 sm:p-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <h3 className="font-bold text-slate-800 text-xs sm:text-base">编辑笔记</h3>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} className="px-3 py-1 text-[10px] sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-all shadow-sm flex items-center gap-1">
              <Save className="w-3 h-3 sm:w-4 h-4" />
              保存
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors">
              <X className="w-4 h-4 sm:w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-slate-50/50 min-h-[100px] sm:min-h-[300px]">
          <EditorContent editor={editor} />
        </div>
        
        <div 
          className="flex flex-wrap items-center gap-1 p-1.5 border-t border-slate-200 bg-white shrink-0 select-none"
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button 
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBold().run();
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={cn("p-1.5 rounded-md transition-colors select-none", editor.isActive('bold') ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100")}
            title="加粗"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button 
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleItalic().run();
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={cn("p-1.5 rounded-md transition-colors select-none", editor.isActive('italic') ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100")}
            title="斜体"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button 
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleUnderline().run();
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={cn("p-1.5 rounded-md transition-colors select-none", editor.isActive('underline') ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100")}
            title="下划线"
          >
            <UnderlineIcon className="w-4 h-4" />
          </button>
          <button 
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleStrike().run();
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={cn("p-1.5 rounded-md transition-colors select-none", editor.isActive('strike') ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100")}
            title="删除线"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
          
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
          
          <button 
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBulletList().run();
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={cn("p-1.5 rounded-md transition-colors select-none", editor.isActive('bulletList') ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100")}
            title="无序列表"
          >
            <List className="w-4 h-4" />
          </button>
          <button 
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleOrderedList().run();
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={cn("p-1.5 rounded-md transition-colors select-none", editor.isActive('orderedList') ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100")}
            title="有序列表"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button 
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBlockquote().run();
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={cn("p-1.5 rounded-md transition-colors select-none", editor.isActive('blockquote') ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100")}
            title="引用"
          >
            <Quote className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-200 mx-1" />

          <div className="relative">
            <button 
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => {
                e.preventDefault();
                handlePickerToggle(e as any, 'color');
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={cn("p-2 rounded-md transition-colors select-none", showColorPicker ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100")} 
              title="字体颜色"
            >
              <Palette className="w-4 h-4" />
            </button>
            {showColorPicker && (
              <div 
                ref={colorPickerRef}
                className="fixed z-[10000] mb-2 bg-white border border-slate-200 shadow-2xl rounded-xl p-3 grid grid-cols-4 gap-2 min-w-[160px] -translate-x-1/2 select-none"
                style={{ bottom: pickerPos.bottom, left: pickerPos.left }}
              >
                {['#000000', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'].map(color => (
                  <button
                    key={color}
                    type="button"
                    tabIndex={-1}
                    onPointerDown={(e) => { 
                      e.preventDefault();
                      editor.chain().focus().setColor(color).run(); 
                      setShowColorPicker(false); 
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    className="w-8 h-8 rounded-full border border-slate-200 hover:scale-110 transition-transform shadow-sm select-none"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button 
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => {
                e.preventDefault();
                handlePickerToggle(e as any, 'highlight');
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={cn("p-2 rounded-md transition-colors select-none", showHighlightPicker ? "bg-slate-200 text-slate-800" : "text-slate-600 hover:bg-slate-100")} 
              title="背景高光"
            >
              <Highlighter className="w-4 h-4" />
            </button>
            {showHighlightPicker && (
              <div 
                ref={highlightPickerRef}
                className="fixed z-[10000] mb-2 bg-white border border-slate-200 shadow-2xl rounded-xl p-3 grid grid-cols-4 gap-2 min-w-[160px] -translate-x-1/2 select-none"
                style={{ bottom: pickerPos.bottom, left: pickerPos.left }}
              >
                {['transparent', '#FEF08A', '#BFDBFE', '#BBF7D0', '#FECACA', '#E9D5FF', '#FBCFE8', '#E5E7EB'].map(color => (
                  <button
                    key={color}
                    type="button"
                    tabIndex={-1}
                    onPointerDown={(e) => { 
                      e.preventDefault();
                      if (color === 'transparent') editor.chain().focus().unsetHighlight().run();
                      else editor.chain().focus().toggleHighlight({ color }).run();
                      setShowHighlightPicker(false);
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    className="w-8 h-8 rounded border border-slate-200 hover:scale-110 transition-transform flex items-center justify-center shadow-sm select-none"
                    style={{ backgroundColor: color === 'transparent' ? '#fff' : color }}
                  >
                    {color === 'transparent' && <span className="text-[10px] text-slate-400">无</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-slate-200 mx-1" />

          <button 
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              editor.chain().focus().undo().run();
            }}
            onMouseDown={(e) => e.preventDefault()}
            disabled={!editor.can().undo()}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 select-none"
            title="撤销"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button 
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              editor.chain().focus().redo().run();
            }}
            onMouseDown={(e) => e.preventDefault()}
            disabled={!editor.can().redo()}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 select-none"
            title="重做"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 pl-12 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0 relative">
          {/* Custom Resize Handle at Bottom-Left */}
          <div 
            className="absolute bottom-0 left-0 w-12 h-12 flex items-end justify-start p-2 cursor-sw-resize z-50 group touch-none"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
          >
            <div className="w-8 h-8 bg-slate-100 rounded-tr-xl rounded-bl-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shadow-sm border border-slate-200">
              <MoveDiagonal className="w-4 h-4 rotate-90" />
            </div>
          </div>

          <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
            取消
          </button>
          <button onClick={handleSave} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-md flex items-center gap-2">
            <Save className="w-4 h-4" />
            保存笔记
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
