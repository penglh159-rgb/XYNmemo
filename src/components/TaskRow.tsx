import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Circle, CheckCircle2, AlertCircle, PlayCircle, Mic, Square, Paperclip, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
import { db, Task, Category, TaskStatus } from '../db';
import { cn } from '../lib/utils';
import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { RichTextEditorModal } from './RichTextEditorModal';
import { ImageViewerModal } from './ImageViewerModal';

interface TaskRowProps {
  task: Task;
  categories: Category[];
  isBatchMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  columns: { id: string; width: number }[];
}

const statusColors: Record<TaskStatus, string> = {
  'todo': 'text-slate-400',
  'in-progress': 'text-blue-500',
  'blocked': 'text-red-500',
  'done': 'text-green-500'
};

const statusLabels: Record<TaskStatus, string> = {
  'todo': '待开始',
  'in-progress': '进行中',
  'blocked': '受阻',
  'done': '已完成'
};

export const TaskRow: React.FC<TaskRowProps> = ({ task, categories, isBatchMode, isSelected, onToggleSelection, columns }) => {
  const category = categories.find(c => c.id === task.categoryId);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [shortNote, setShortNote] = useState(task.shortNote);

  const [isEditingRichText, setIsEditingRichText] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
  };

  const handleStatusClick = async () => {
    const sequence: TaskStatus[] = ['todo', 'in-progress', 'done', 'todo'];
    const currentIndex = sequence.indexOf(task.status);
    const nextStatus = sequence[currentIndex + 1] || 'todo';
    await db.tasks.update(task.id, { status: nextStatus });
  };

  const handleStatusLongPress = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const reason = window.prompt('请输入受阻原因：');
    if (reason !== null) {
      await db.tasks.update(task.id, { 
        status: 'blocked',
        shortNote: reason ? `[受阻] ${reason}` : task.shortNote
      });
    }
  };

  const handleTitleBlur = async () => {
    setIsEditingTitle(false);
    if (title !== task.title) {
      await db.tasks.update(task.id, { title });
    }
  };

  const handleNoteBlur = async () => {
    setIsEditingNote(false);
    if (shortNote !== task.shortNote) {
      await db.tasks.update(task.id, { shortNote });
    }
  };

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await db.tasks.update(task.id, { date: e.target.value });
  };

  // Audio recording logic
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (task.audioBlob) {
      const url = URL.createObjectURL(task.audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [task.audioBlob]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await db.tasks.update(task.id, { audioBlob });
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('无法访问麦克风，请检查权限设置。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // File upload logic
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const newAttachment = {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
      data: file
    };

    await db.tasks.update(task.id, {
      attachments: [...(task.attachments || []), newAttachment]
    });
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          ...style,
          gridTemplateColumns: columns.map(c => `${c.width}px`).join(' ')
        }}
        className={cn(
          "grid gap-4 p-3 items-center bg-white hover:bg-slate-50/80 transition-colors group/row",
          isDragging && "shadow-lg ring-1 ring-blue-500/20 opacity-90",
          isSelected && "bg-blue-50/50"
        )}
      >
        {/* Actions */}
        <div className="flex items-center justify-center gap-1">
          {isBatchMode && (
            <input 
              type="checkbox" 
              checked={isSelected}
              onChange={onToggleSelection}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 mr-1"
            />
          )}
          <button
            {...attributes}
            {...listeners}
            className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-1"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <button
            onClick={handleStatusClick}
            onContextMenu={handleStatusLongPress}
            className={cn("p-1 transition-colors", statusColors[task.status])}
            title="点击切换状态，长按设为受阻"
          >
            {task.status === 'done' ? <CheckCircle2 className="w-5 h-5" /> :
             task.status === 'blocked' ? <AlertCircle className="w-5 h-5" /> :
             <Circle className={cn("w-5 h-5", task.status === 'in-progress' && "fill-blue-100")} />}
          </button>
          <button
            onClick={async () => {
              if (window.confirm('确定删除该事项吗？')) {
                await db.tasks.delete(task.id);
              }
            }}
            className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-opacity"
            title="删除事项"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        <div className="relative group">
          {category && (
            <span 
              className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium opacity-80"
              style={{ backgroundColor: category.color }}
            >
              {category.name}
            </span>
          )}
          {isEditingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
              className="w-full text-sm bg-blue-50 border-blue-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          ) : (
            <div 
              onDoubleClick={() => setIsEditingTitle(true)}
              className="text-sm text-slate-700 break-words cursor-text p-1 rounded hover:bg-slate-100"
            >
              {task.title || <span className="text-slate-400 italic">双击编辑事项...</span>}
            </div>
          )}
        </div>

        {/* Date */}
        <div>
          <input
            type="date"
            value={task.date}
            onChange={handleDateChange}
            className="text-sm text-slate-600 bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-blue-600"
          />
        </div>

        {/* Status */}
        <div>
          <span className={cn(
            "text-xs font-medium px-2 py-1 rounded-full",
            task.status === 'todo' && "bg-slate-100 text-slate-600",
            task.status === 'in-progress' && "bg-blue-50 text-blue-700",
            task.status === 'blocked' && "bg-red-50 text-red-700",
            task.status === 'done' && "bg-green-50 text-green-700"
          )}>
            {statusLabels[task.status]}
          </span>
        </div>

        {/* Audio */}
        <div className="flex items-center gap-2">
          {isRecording ? (
            <button onClick={stopRecording} className="text-red-500 animate-pulse p-1">
              <Square className="w-5 h-5 fill-current" />
            </button>
          ) : !audioUrl ? (
            <button onClick={startRecording} className="text-slate-400 hover:text-red-500 p-1 transition-colors">
              <Mic className="w-5 h-5" />
            </button>
          ) : (
            <div className="flex items-center gap-2 w-full bg-slate-100 rounded-full px-2 py-1">
              <button onClick={togglePlay} className="text-blue-600 hover:text-blue-700">
                {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <PlayCircle className="w-4 h-4" />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={progress}
                onChange={(e) => {
                  if (audioRef.current) {
                    const time = (Number(e.target.value) / 100) * audioRef.current.duration;
                    audioRef.current.currentTime = time;
                    setProgress(Number(e.target.value));
                  }
                }}
                className="w-full h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer"
              />
              <audio 
                ref={audioRef} 
                src={audioUrl} 
                onTimeUpdate={(e) => {
                  const target = e.target as HTMLAudioElement;
                  setProgress((target.currentTime / target.duration) * 100 || 0);
                }}
                onEnded={() => setIsPlaying(false)}
                className="hidden" 
              />
              <button 
                onClick={async () => {
                  if (window.confirm('确定删除录音吗？')) {
                    await db.tasks.update(task.id, { audioBlob: undefined });
                    setAudioUrl(null);
                  }
                }}
                className="text-slate-400 hover:text-red-500 text-xs"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Short Note */}
        <div>
          {isEditingNote ? (
            <textarea
              autoFocus
              value={shortNote}
              onChange={(e) => setShortNote(e.target.value)}
              onBlur={handleNoteBlur}
              className="w-full text-xs bg-yellow-50 border-yellow-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-yellow-500/20 resize-none"
              rows={2}
            />
          ) : (
            <div 
              onDoubleClick={() => setIsEditingNote(true)}
              className="text-xs text-slate-600 break-words cursor-text p-1 rounded hover:bg-slate-100 line-clamp-2"
            >
              {task.shortNote || <span className="text-slate-400 italic">添加短注...</span>}
            </div>
          )}
        </div>

        {/* Notes (Rich Text Preview) */}
        <div 
          onClick={() => setIsEditingRichText(true)}
          className="text-xs text-slate-500 line-clamp-2 cursor-pointer hover:text-slate-700 p-1 rounded hover:bg-slate-100"
        >
          {task.notes ? (
            <div dangerouslySetInnerHTML={{ __html: task.notes }} />
          ) : (
            <span className="italic">点击编辑笔记...</span>
          )}
        </div>

        {/* Attachments */}
        <div className="flex items-center gap-1 flex-wrap">
          {task.attachments?.map(att => {
            const isImage = att.type.startsWith('image/');
            const url = URL.createObjectURL(att.data);
            return (
              <div 
                key={att.id} 
                className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-200 overflow-hidden relative group/att" 
                title={att.name}
                onClick={() => {
                  if (isImage) {
                    setPreviewImageUrl(url);
                  } else {
                    window.open(url, '_blank');
                  }
                }}
              >
                {isImage ? (
                  <img src={url} alt={att.name} className="w-full h-full object-cover" />
                ) : (
                  <FileText className="w-3 h-3 text-slate-500" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('确定删除该附件吗？')) {
                      db.tasks.update(task.id, {
                        attachments: task.attachments.filter(a => a.id !== att.id)
                      });
                    }
                  }}
                  className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-6 h-6 rounded border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-500 transition-colors"
          >
            <Paperclip className="w-3 h-3" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
        </div>
      </div>

      {isEditingRichText && (
        <RichTextEditorModal
          initialContent={task.notes || ''}
          onSave={async (content) => {
            await db.tasks.update(task.id, { notes: content });
          }}
          onClose={() => setIsEditingRichText(false)}
        />
      )}

      {previewImageUrl && (
        <ImageViewerModal
          imageUrl={previewImageUrl}
          onClose={() => setPreviewImageUrl(null)}
        />
      )}
    </>
  );
};
