import JSZip from 'jszip';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Circle, CheckCircle2, AlertCircle, PlayCircle, Mic, Square, Paperclip, FileText, Image as ImageIcon, Trash2, ChevronDown, ChevronUp, Tag, Plus, X as XIcon, Calendar, Clock, Download } from 'lucide-react';
import { db, Task, Category, TaskStatus } from '../db';
import { cn } from '../lib/utils';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { RichTextEditorModal } from './RichTextEditorModal';
import { ImageViewerModal } from './ImageViewerModal';

const AudioCell = ({ task, colId }: { task: Task, colId: string }) => {
  const isMain = colId === 'audio';
  const audioBlob = isMain ? task.audioBlob : task.customFields?.[colId];

  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isAudioPopoverOpen, setIsAudioPopoverOpen] = useState(false);

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
    }
  }, [audioBlob]);

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
        const mimeType = mediaRecorder.mimeType || 'audio/mp4';
        const newBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (isMain) {
          await db.tasks.update(task.id, { audioBlob: newBlob });
        } else {
          await db.tasks.update(task.id, {
            customFields: { ...(task.customFields || {}), [colId]: newBlob }
          });
        }
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

  return (
    <div className="flex items-center justify-center relative" style={{ gridRow: 1 }}>
      <button 
        onClick={() => setIsAudioPopoverOpen(!isAudioPopoverOpen)}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm border",
          isRecording ? "bg-red-500 text-white animate-pulse border-red-600" :
          audioUrl ? "bg-blue-100 text-blue-600 border-blue-200 hover:bg-blue-200" :
          "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200 hover:text-slate-600"
        )}
      >
        {isRecording ? <Square className="w-4 h-4 fill-current" /> :
         audioUrl ? <PlayCircle className="w-5 h-5" /> :
         <Mic className="w-4 h-4" />}
      </button>

      {isAudioPopoverOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4" onClick={() => setIsAudioPopoverOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-4 w-full max-w-[300px] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-slate-700">录音控制</span>
              <button onClick={() => setIsAudioPopoverOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              {isRecording ? (
                <button onClick={stopRecording} className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white py-3 rounded-lg hover:bg-red-600 transition-colors shadow-sm">
                  <Square className="w-5 h-5 fill-current" />
                  <span className="text-sm font-bold">停止录音</span>
                </button>
              ) : !audioUrl ? (
                <button onClick={startRecording} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                  <Mic className="w-5 h-5" />
                  <span className="text-sm font-bold">开始录音</span>
                </button>
              ) : (
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <button onClick={togglePlay} className="text-blue-600 hover:text-blue-700">
                      {isPlaying ? <Square className="w-6 h-6 fill-current" /> : <PlayCircle className="w-7 h-7" />}
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
                      className="flex-1 h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
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
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={async () => {
                        if (window.confirm('确定删除录音吗？')) {
                          if (isMain) {
                            await db.tasks.update(task.id, { audioBlob: undefined });
                          } else {
                            const newCustomFields = { ...task.customFields };
                            delete newCustomFields[colId];
                            await db.tasks.update(task.id, { customFields: newCustomFields });
                          }
                          setAudioUrl(null);
                        }
                      }}
                      className="flex-1 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 py-2 rounded-lg transition-colors border border-red-100"
                    >
                      删除录音
                    </button>
                    <button 
                      onClick={startRecording}
                      className="flex-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 py-2 rounded-lg transition-colors border border-blue-100"
                    >
                      重新录制
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const AttachmentCell = ({ task, colId, setPreviewImageUrl }: { task: Task, colId: string, setPreviewImageUrl: (url: string) => void }) => {
  const isMain = colId === 'attachments';
  const attachments = isMain ? (task.attachments || []) : (task.customFields?.[colId] || []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isManagingAttachments, setIsManagingAttachments] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
      data: file
    }));

    const updatedAttachments = [...attachments, ...newAttachments];
    if (isMain) {
      await db.tasks.update(task.id, { attachments: updatedAttachments });
    } else {
      await db.tasks.update(task.id, {
        customFields: { ...(task.customFields || {}), [colId]: updatedAttachments }
      });
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleAttachmentSelection = (id: string) => {
    setSelectedAttachments(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const deleteSelectedAttachments = async () => {
    if (selectedAttachments.length === 0) return;
    if (window.confirm(`确定删除选中的 ${selectedAttachments.length} 个附件吗？`)) {
      const remaining = attachments.filter((a: any) => !selectedAttachments.includes(a.id));
      if (isMain) {
        await db.tasks.update(task.id, { attachments: remaining });
      } else {
        await db.tasks.update(task.id, {
          customFields: { ...(task.customFields || {}), [colId]: remaining }
        });
      }
      setSelectedAttachments([]);
    }
  };

  const downloadSelectedAttachments = async () => {
    if (selectedAttachments.length === 0) return;
    const selected = attachments.filter((a: any) => selectedAttachments.includes(a.id));
    
    if (selected.length === 1) {
      const attachment = selected[0];
      const url = URL.createObjectURL(attachment.data || attachment.file);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const zip = new JSZip();
      selected.forEach((attachment: any) => {
        zip.file(attachment.name, attachment.data || attachment.file);
      });
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vonote-attachments-${new Date().getTime()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setSelectedAttachments([]);
  };

  return (
    <div className="flex items-center gap-1 flex-wrap" style={{ gridRow: 1 }}>
      {attachments.slice(0, 3).map((att: any) => {
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
              <img src={url} alt={att.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <FileText className="w-3 h-3 text-slate-500" />
            )}
          </div>
        );
      })}
      {attachments.length > 3 && (
        <button 
          onClick={() => setIsManagingAttachments(true)}
          className="text-[10px] text-slate-400 hover:text-blue-500 px-1"
        >
          +{attachments.length - 3}
        </button>
      )}
      <div className="flex items-center gap-1">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-6 h-6 rounded border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-500 transition-colors"
          title="添加附件"
        >
          <Paperclip className="w-3 h-3" />
        </button>
        {attachments.length > 0 && (
          <button 
            onClick={() => setIsManagingAttachments(true)}
            className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors"
            title="管理附件"
          >
            <FileText className="w-3 h-3" />
          </button>
        )}
      </div>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        multiple
        accept="*/*"
      />

      {isManagingAttachments && createPortal(
        <div 
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsManagingAttachments(false)}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">管理附件</h3>
              <button onClick={() => setIsManagingAttachments(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 flex flex-col gap-2">
              {attachments.map((att: any) => (
                <div key={att.id} className="flex items-center gap-3 p-2 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedAttachments.includes(att.id)}
                    onChange={() => toggleAttachmentSelection(att.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center shrink-0">
                    {att.type.startsWith('image/') ? (
                      <img src={URL.createObjectURL(att.data)} alt={att.name} className="w-full h-full object-cover rounded" />
                    ) : (
                      <FileText className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">{att.name}</div>
                    <div className="text-xs text-slate-400">{(att.size / 1024).toFixed(1)} KB</div>
                  </div>
                </div>
              ))}
              {attachments.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">暂无附件</div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="text-xs text-slate-500">已选择 {selectedAttachments.length} 个附件</span>
              <div className="flex gap-2">
                <button 
                  onClick={downloadSelectedAttachments}
                  disabled={selectedAttachments.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  下载选中
                </button>
                <button 
                  onClick={deleteSelectedAttachments}
                  disabled={selectedAttachments.length === 0}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  删除选中
                </button>
                <button 
                  onClick={() => setIsManagingAttachments(false)}
                  className="px-4 py-2 bg-white text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors shadow-sm"
                >
                  完成
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

interface TaskRowProps {
  task: Task;
  categories: Category[];
  isBatchMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  columns: { id: string; width: number }[];
  currentCategoryId?: string | null;
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

export const TaskRow: React.FC<TaskRowProps> = ({ task, categories, isBatchMode, isSelected, onToggleSelection, columns, currentCategoryId }) => {
  const category = categories.find(c => c.id === task.categoryId);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [shortNote, setShortNote] = useState(task.shortNote);

  const [isEditingBlockedReason, setIsEditingBlockedReason] = useState(false);
  const [blockedReason, setBlockedReason] = useState(task.blockedReason || '');

  useEffect(() => {
    setShortNote(task.shortNote);
  }, [task.shortNote]);

  useEffect(() => {
    setBlockedReason(task.blockedReason || '');
  }, [task.blockedReason]);

  const [editingRichTextColId, setEditingRichTextColId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isBlockedReasonExpanded, setIsBlockedReasonExpanded] = useState(false);
  const [isAudioPopoverOpen, setIsAudioPopoverOpen] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isEditingCustom, setIsEditingCustom] = useState<Record<string, boolean>>({});
  const [customFields, setCustomFields] = useState<Record<string, string>>(task.customFields || {});
  
  useEffect(() => {
    setCustomFields(task.customFields || {});
  }, [task.customFields]);

  const [isCategorySelectOpen, setIsCategorySelectOpen] = useState(false);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagPopoverRef = useRef<HTMLDivElement>(null);
  const categoryPopoverRef = useRef<HTMLDivElement>(null);

  const allExistingTags = useLiveQuery(async () => {
    let tasks;
    if (currentCategoryId) {
      tasks = await db.tasks.where('categoryId').equals(currentCategoryId).toArray();
    } else {
      tasks = await db.tasks.toArray();
    }
    const tags = new Set<string>();
    tasks.forEach(t => t.tags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [currentCategoryId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagPopoverRef.current && !tagPopoverRef.current.contains(event.target as Node)) {
        setIsAddingTag(false);
      }
      if (categoryPopoverRef.current && !categoryPopoverRef.current.contains(event.target as Node)) {
        setIsCategorySelectOpen(false);
      }
    };
    if (isAddingTag || isCategorySelectOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddingTag, isCategorySelectOpen]);

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
    zIndex: isDragging ? 9999 : (isAddingTag || isAudioPopoverOpen || isCategorySelectOpen ? 9998 : 1),
  };

  const handleStatusClick = async () => {
    const sequence: TaskStatus[] = ['todo', 'in-progress', 'blocked', 'done', 'todo'];
    const currentIndex = sequence.indexOf(task.status);
    const nextStatus = sequence[currentIndex + 1] || 'todo';
    await db.tasks.update(task.id, { status: nextStatus });
  };

  const handleStatusLongPress = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const reason = window.prompt('请输入受阻原因（可选）：');
    if (reason !== null) {
      await db.tasks.update(task.id, { 
        status: 'blocked',
        blockedReason: reason || ''
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

  const handleAddTag = async (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !(task.tags || []).includes(trimmedTag)) {
      const newTags = [...(task.tags || []), trimmedTag];
      await db.tasks.update(task.id, { tags: newTags });
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const newTags = (task.tags || []).filter(t => t !== tagToRemove);
    await db.tasks.update(task.id, { tags: newTags });
  };

  const handleBlockedReasonBlur = async () => {
    setIsEditingBlockedReason(false);
    if (blockedReason !== task.blockedReason) {
      await db.tasks.update(task.id, { blockedReason });
    }
  };

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await db.tasks.update(task.id, { date: e.target.value });
  };

  const handleTimeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await db.tasks.update(task.id, { time: e.target.value });
  };

  const handleCustomFieldChange = (colId: string, value: string) => {
    setCustomFields(prev => ({ ...prev, [colId]: value }));
  };

  const handleCustomFieldBlur = async (colId: string) => {
    setIsEditingCustom(prev => ({ ...prev, [colId]: false }));
    await db.tasks.update(task.id, {
      customFields: {
        ...(task.customFields || {}),
        [colId]: customFields[colId]
      }
    });
  };

  const statusIndex = columns.findIndex(c => c.id === 'status');
  
  // Calculate grid column span for blocked reason
  // We need to handle cases where columns might be reordered or hidden
  const getBlockedReasonStyle = () => {
    const statusIdx = columns.findIndex(c => c.id === 'status');
    const titleIdx = columns.findIndex(c => c.id === 'title');
    
    if (statusIdx === -1 || titleIdx === -1) return null;
    
    // Grid columns are 1-indexed
    const start = Math.min(statusIdx, titleIdx) + 1;
    const end = Math.max(statusIdx, titleIdx) + 2;
    
    return {
      gridColumn: `${start} / ${end}`,
    };
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
          "relative grid gap-4 p-3 items-center bg-white hover:bg-slate-50/80 transition-colors group/row border-b border-slate-100",
          isDragging && "shadow-lg ring-1 ring-blue-500/20 opacity-90",
          isSelected && "bg-blue-50/50"
        )}
      >
        {columns.map((col) => {
          if (col.id === 'status') {
            return (
              <div key={col.id} className="flex items-center justify-center gap-1" style={{ gridRow: 1 }}>
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
                  className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-1 touch-none"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
                <button
                  onClick={handleStatusClick}
                  onContextMenu={handleStatusLongPress}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold transition-all border shadow-sm whitespace-nowrap",
                    task.status === 'todo' && "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200",
                    task.status === 'in-progress' && "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
                    task.status === 'blocked' && "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
                    task.status === 'done' && "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                  )}
                  title="点击切换状态，长按设为受阻"
                >
                  {statusLabels[task.status]}
                </button>
              </div>
            );
          }

          if (col.id === 'title') {
            return (
              <div key={col.id} className="relative group flex flex-col gap-1" style={{ gridRow: 1 }}>
                <div className="flex justify-between items-start gap-2 min-h-[20px]">
                  <div className="relative">
                    {category && (
                      <button 
                        onClick={() => setIsCategorySelectOpen(true)}
                        className="text-[9px] px-1.5 py-0.5 rounded-sm text-white font-bold opacity-90 shadow-sm hover:opacity-100 hover:scale-105 transition-all"
                        style={{ backgroundColor: category.color }}
                        title="点击更改分类"
                      >
                        {category.name}
                      </button>
                    )}
                    
                    {isCategorySelectOpen && (
                      <div 
                        ref={categoryPopoverRef}
                        className="absolute top-full left-0 mt-1 z-[100] bg-white border border-slate-200 shadow-xl rounded-lg p-2 min-w-[150px]"
                      >
                        <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">更改分类</span>
                          <button onClick={() => setIsCategorySelectOpen(false)} className="text-slate-400 hover:text-slate-600">
                            <XIcon className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                          {categories.map(c => (
                            <button
                              key={c.id}
                              onClick={async () => {
                                await db.tasks.update(task.id, { categoryId: c.id });
                                setIsCategorySelectOpen(false);
                              }}
                              className="text-left px-2 py-1.5 rounded text-[11px] hover:bg-slate-100 transition-colors flex items-center gap-2"
                            >
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                              {c.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap justify-end gap-1 flex-1 min-w-0">
                    {task.tags && task.tags.length > 0 && (
                      <>
                        {(isTagsExpanded ? task.tags : task.tags.slice(0, 2)).map(tag => (
                          <span 
                            key={tag}
                            className="text-[9px] pl-1.5 pr-1 py-0.5 rounded-sm bg-slate-100 text-slate-500 border border-slate-200 font-medium flex items-center gap-0.5 max-w-full"
                          >
                            <span className="truncate">#{tag}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }}
                              className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded p-0.5 transition-colors shrink-0"
                              title="删除标签"
                            >
                              <XIcon className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                        {task.tags.length > 2 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setIsTagsExpanded(!isTagsExpanded); }}
                            className="text-[9px] px-1.5 py-0.5 rounded-sm bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100 transition-colors shrink-0"
                          >
                            {isTagsExpanded ? '收起' : `+${task.tags.length - 2}`}
                          </button>
                        )}
                      </>
                    )}
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsAddingTag(!isAddingTag); }}
                        className="text-[9px] px-2 py-0.5 rounded-sm bg-blue-50 text-blue-700 border border-blue-200 font-bold hover:bg-blue-100 transition-all shadow-sm flex items-center justify-center min-w-[20px]"
                        title="添加标签"
                      >
                        +
                      </button>
                      
                      {isAddingTag && (
                        <div 
                          ref={tagPopoverRef}
                          className="absolute top-full right-0 mt-1 z-[100] bg-white border border-slate-200 shadow-xl rounded-lg p-2 min-w-[160px] animate-in fade-in slide-in-from-top-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                        <div className="flex items-center gap-1 mb-2">
                          <input
                            ref={tagInputRef}
                            autoFocus
                            value={newTagInput}
                            onChange={(e) => setNewTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddTag(newTagInput);
                              }
                            }}
                            placeholder="输入新标签..."
                            className="flex-1 text-[10px] px-2 py-1 border border-slate-200 rounded outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button 
                            onClick={() => handleAddTag(newTagInput)}
                            className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        
                        {allExistingTags && allExistingTags.length > 0 && (
                          <div className="max-h-[150px] overflow-y-auto flex flex-col gap-1">
                            <div className="text-[9px] font-bold text-slate-400 uppercase mb-1 px-1 shrink-0">常用标签</div>
                            {allExistingTags
                              .filter(tag => !(task.tags || []).includes(tag))
                              .filter(tag => tag.toLowerCase().includes(newTagInput.toLowerCase()))
                              .map(tag => (
                                <button
                                  key={tag}
                                  onClick={() => handleAddTag(tag)}
                                  className="text-left px-2 py-1.5 rounded text-[10px] text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors truncate shrink-0"
                                >
                                  #{tag}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                </div>

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
            );
          }

          if (col.id === 'date') {
            return (
              <div key={col.id} className="flex flex-col gap-1 relative group/date" style={{ gridRow: 1 }}>
                <div className="flex items-center relative">
                  <input
                    type="date"
                    value={task.date}
                    onChange={handleDateChange}
                    className={cn(
                      "text-sm bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-blue-600 w-full",
                      task.date ? "text-slate-600" : "text-transparent"
                    )}
                  />
                  {!task.date && (
                    <div className="absolute left-0 pointer-events-none flex items-center text-slate-400 text-xs gap-1 opacity-60 group-hover/date:opacity-100 transition-opacity">
                      <Calendar className="w-3 h-3" />
                      <span>设置日期</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center relative">
                  <input
                    type="time"
                    value={task.time || ''}
                    onChange={handleTimeChange}
                    className={cn(
                      "text-[10px] bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-blue-600 w-full",
                      task.time ? "text-blue-500 font-medium" : "text-transparent"
                    )}
                  />
                  {!task.time && (
                    <div className="absolute left-0 pointer-events-none flex items-center text-slate-400 text-[10px] gap-1 opacity-60 group-hover/date:opacity-100 transition-opacity">
                      <Clock className="w-3 h-3" />
                      <span>设置时间</span>
                    </div>
                  )}
                </div>
              </div>
            );
          }


          if (col.id.startsWith('audio')) {
            return <AudioCell key={col.id} task={task} colId={col.id} />;
          }

          if (col.id.startsWith('shortNote')) {
            const isMainNote = col.id === 'shortNote';
            const noteValue = isMainNote ? shortNote : (customFields[col.id] || '');
            const isEditing = isMainNote ? isEditingNote : isEditingCustom[col.id];
            const isExpanded = expandedNotes[col.id];
            
            return (
              <div key={col.id} className="flex flex-col gap-1 relative group/note" style={{ gridRow: 1 }}>
                {isEditing ? (
                  <textarea
                    autoFocus
                    value={noteValue}
                    onChange={(e) => {
                      if (isMainNote) setShortNote(e.target.value);
                      else handleCustomFieldChange(col.id, e.target.value);
                    }}
                    onBlur={() => {
                      if (isMainNote) handleNoteBlur();
                      else handleCustomFieldBlur(col.id);
                    }}
                    className="w-full text-xs bg-yellow-50 border-yellow-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-yellow-500/20 resize-none min-h-[60px]"
                  />
                ) : (
                  <div className="relative">
                    <div 
                      onDoubleClick={() => {
                        if (isMainNote) setIsEditingNote(true);
                        else setIsEditingCustom(prev => ({ ...prev, [col.id]: true }));
                      }}
                      className={cn(
                        "text-xs text-slate-600 break-words cursor-text p-1 rounded hover:bg-slate-100 whitespace-pre-wrap",
                        !isExpanded && "line-clamp-2"
                      )}
                    >
                      {(isMainNote ? task.shortNote : customFields[col.id]) || <span className="text-slate-400 italic">添加短注...</span>}
                    </div>
                    {((isMainNote ? task.shortNote : customFields[col.id])?.length || 0) > 40 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedNotes(prev => ({ ...prev, [col.id]: !prev[col.id] }));
                        }}
                        className="absolute bottom-0 right-0 text-blue-500 bg-blue-50/90 hover:bg-blue-100 p-0.5 rounded-tl rounded-br z-10 transition-colors shadow-sm"
                        title={isExpanded ? '收起' : '展开'}
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          }

          if (col.id.startsWith('notes')) {
            const isMain = col.id === 'notes';
            const val = isMain ? task.notes : customFields[col.id];
            return (
              <div 
                key={col.id}
                onClick={() => setEditingRichTextColId(col.id)}
                className="text-xs text-slate-500 line-clamp-2 cursor-pointer hover:text-slate-700 p-1 rounded hover:bg-slate-100"
                style={{ gridRow: 1 }}
              >
                {val ? (
                  <div dangerouslySetInnerHTML={{ __html: val }} />
                ) : (
                  <span className="italic">点击编辑笔记...</span>
                )}
              </div>
            );
          }

          if (col.id.startsWith('attachments')) {
            return <AttachmentCell key={col.id} task={task} colId={col.id} setPreviewImageUrl={setPreviewImageUrl} />;
          }

          if (col.id.startsWith('custom_')) {
            return (
              <div key={col.id} className="flex flex-col gap-1" style={{ gridRow: 1 }}>
                {isEditingCustom[col.id] ? (
                  <textarea
                    autoFocus
                    value={customFields[col.id] || ''}
                    onChange={(e) => handleCustomFieldChange(col.id, e.target.value)}
                    onBlur={() => handleCustomFieldBlur(col.id)}
                    className="w-full text-xs bg-yellow-50 border-yellow-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-yellow-500/20 resize-none"
                    rows={2}
                  />
                ) : (
                  <div 
                    onDoubleClick={() => setIsEditingCustom(prev => ({ ...prev, [col.id]: true }))}
                    className="text-xs text-slate-600 break-words cursor-text p-1 rounded hover:bg-slate-100 line-clamp-2 min-h-[24px]"
                  >
                    {customFields[col.id] || <span className="text-slate-400 italic">添加内容...</span>}
                  </div>
                )}
              </div>
            );
          }

          return null;
        })}

        {/* Blocked Reason Spanning Section */}
        {task.status === 'blocked' && getBlockedReasonStyle() && (
          <div 
            style={{ ...getBlockedReasonStyle()!, gridRow: 2 }}
            className="mt-1 border-t border-red-100 pt-1"
          >
            <div className="flex items-start gap-2">
              <button 
                onClick={() => setIsBlockedReasonExpanded(!isBlockedReasonExpanded)}
                className="text-red-400 hover:text-red-600 transition-colors mt-0.5"
              >
                {isBlockedReasonExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              
              <div className="flex-1">
                {isEditingBlockedReason ? (
                  <textarea
                    autoFocus
                    value={blockedReason}
                    onChange={(e) => setBlockedReason(e.target.value)}
                    onBlur={handleBlockedReasonBlur}
                    className="w-full text-[11px] bg-red-50 border-red-200 text-red-600 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-red-500/20 resize-none min-h-[40px]"
                    rows={2}
                  />
                ) : (
                  <div 
                    onClick={() => setIsEditingBlockedReason(true)}
                    className={cn(
                      "text-[11px] text-red-600 font-bold cursor-pointer hover:bg-red-50 px-2 py-0.5 rounded break-words",
                      !isBlockedReasonExpanded && "line-clamp-1"
                    )}
                  >
                    [受阻] {task.blockedReason || '点击添加原因...'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {editingRichTextColId && (
        <RichTextEditorModal
          initialContent={editingRichTextColId === 'notes' ? (task.notes || '') : (customFields[editingRichTextColId] || '')}
          onSave={async (content) => {
            if (editingRichTextColId === 'notes') {
              await db.tasks.update(task.id, { notes: content });
            } else {
              setCustomFields(prev => ({ ...prev, [editingRichTextColId]: content }));
              await db.tasks.update(task.id, { customFields: { ...task.customFields, [editingRichTextColId]: content } });
            }
            setEditingRichTextColId(null);
          }}
          onClose={() => setEditingRichTextColId(null)}
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
