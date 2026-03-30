import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Circle, CheckCircle2, AlertCircle, PlayCircle, Mic, Square, Paperclip, FileText, Image as ImageIcon, Trash2, ChevronDown, ChevronUp, Tag, Plus, X as XIcon } from 'lucide-react';
import { db, Task, Category, TaskStatus } from '../db';
import { cn } from '../lib/utils';
import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
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

  const [isEditingBlockedReason, setIsEditingBlockedReason] = useState(false);
  const [blockedReason, setBlockedReason] = useState(task.blockedReason || '');

  useEffect(() => {
    setShortNote(task.shortNote);
  }, [task.shortNote]);

  useEffect(() => {
    setBlockedReason(task.blockedReason || '');
  }, [task.blockedReason]);

  const [isEditingRichText, setIsEditingRichText] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isBlockedReasonExpanded, setIsBlockedReasonExpanded] = useState(false);
  const [isAudioPopoverOpen, setIsAudioPopoverOpen] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagPopoverRef = useRef<HTMLDivElement>(null);

  const allExistingTags = useLiveQuery(async () => {
    const tasks = await db.tasks.toArray();
    const tags = new Set<string>();
    tasks.forEach(t => t.tags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagPopoverRef.current && !tagPopoverRef.current.contains(event.target as Node)) {
        setIsAddingTag(false);
      }
    };
    if (isAddingTag) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddingTag]);

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
    zIndex: isDragging ? 50 : (isAddingTag || isAudioPopoverOpen ? 40 : 1),
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

    const newAttachments = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
      data: file
    }));

    await db.tasks.update(task.id, {
      attachments: [...(task.attachments || []), ...newAttachments]
    });
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [isManagingAttachments, setIsManagingAttachments] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);

  const toggleAttachmentSelection = (id: string) => {
    setSelectedAttachments(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const deleteSelectedAttachments = async () => {
    if (selectedAttachments.length === 0) return;
    if (window.confirm(`确定删除选中的 ${selectedAttachments.length} 个附件吗？`)) {
      const remaining = (task.attachments || []).filter(a => !selectedAttachments.includes(a.id));
      await db.tasks.update(task.id, { attachments: remaining });
      setSelectedAttachments([]);
    }
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
            );
          }

          if (col.id === 'title') {
            return (
              <div key={col.id} className="relative group pt-4" style={{ gridRow: 1 }}>
                {category && (
                  <span 
                    className="absolute -top-1 -left-1 text-[9px] px-1.5 py-0.5 rounded-sm text-white font-bold opacity-90 shadow-sm z-10"
                    style={{ backgroundColor: category.color }}
                  >
                    {category.name}
                  </span>
                )}
                
                <div className="absolute -top-1 -right-1 flex flex-wrap justify-end gap-1 max-w-[70%] z-10">
                  {task.tags?.map(tag => (
                    <span 
                      key={tag}
                      onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }}
                      className="text-[9px] px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-500 border border-slate-200 font-medium cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                      title="点击删除标签"
                    >
                      #{tag}
                    </span>
                  ))}
                  <div className="relative">
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
                        className="absolute top-full right-0 mt-1 z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-2 min-w-[160px] animate-in fade-in slide-in-from-top-1"
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
                          <div className="max-h-[120px] overflow-y-auto flex flex-col gap-1">
                            <div className="text-[9px] font-bold text-slate-400 uppercase mb-1 px-1">常用标签</div>
                            {allExistingTags
                              .filter(tag => !(task.tags || []).includes(tag))
                              .filter(tag => tag.toLowerCase().includes(newTagInput.toLowerCase()))
                              .map(tag => (
                                <button
                                  key={tag}
                                  onClick={() => handleAddTag(tag)}
                                  className="text-left px-2 py-1 rounded text-[10px] text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors truncate"
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
              <div key={col.id} className="flex flex-col gap-1" style={{ gridRow: 1 }}>
                <input
                  type="date"
                  value={task.date}
                  onChange={handleDateChange}
                  className="text-sm text-slate-600 bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-blue-600"
                />
                <input
                  type="time"
                  value={task.time || ''}
                  onChange={handleTimeChange}
                  className={cn(
                    "text-[10px] text-slate-400 bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-blue-600",
                    task.time && "text-blue-500 font-medium"
                  )}
                />
              </div>
            );
          }


          if (col.id === 'audio') {
            return (
              <div key={col.id} className="flex items-center justify-center relative" style={{ gridRow: 1 }}>
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

                {isAudioPopoverOpen && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 min-w-[240px] animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500">录音控制</span>
                      <button onClick={() => setIsAudioPopoverOpen(false)} className="text-slate-400 hover:text-slate-600">×</button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {isRecording ? (
                        <button onClick={stopRecording} className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors shadow-sm">
                          <Square className="w-4 h-4 fill-current" />
                          <span className="text-xs font-bold">停止录音</span>
                        </button>
                      ) : !audioUrl ? (
                        <button onClick={startRecording} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                          <Mic className="w-4 h-4" />
                          <span className="text-xs font-bold">开始录音</span>
                        </button>
                      ) : (
                        <div className="flex flex-col gap-2 w-full">
                          <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 border border-slate-100">
                            <button onClick={togglePlay} className="text-blue-600 hover:text-blue-700">
                              {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <PlayCircle className="w-5 h-5" />}
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
                              className="flex-1 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
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
                                  await db.tasks.update(task.id, { audioBlob: undefined });
                                  setAudioUrl(null);
                                }
                              }}
                              className="flex-1 text-[10px] font-bold text-red-500 hover:bg-red-50 py-1 rounded transition-colors"
                            >
                              删除录音
                            </button>
                            <button 
                              onClick={startRecording}
                              className="flex-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 py-1 rounded transition-colors"
                            >
                              重新录制
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          if (col.id === 'shortNote') {
            return (
              <div key={col.id} className="flex flex-col gap-1" style={{ gridRow: 1 }}>
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
            );
          }

          if (col.id === 'notes') {
            return (
              <div 
                key={col.id}
                onClick={() => setIsEditingRichText(true)}
                className="text-xs text-slate-500 line-clamp-2 cursor-pointer hover:text-slate-700 p-1 rounded hover:bg-slate-100"
                style={{ gridRow: 1 }}
              >
                {task.notes ? (
                  <div dangerouslySetInnerHTML={{ __html: task.notes }} />
                ) : (
                  <span className="italic">点击编辑笔记...</span>
                )}
              </div>
            );
          }

          if (col.id === 'attachments') {
            return (
              <div key={col.id} className="flex items-center gap-1 flex-wrap" style={{ gridRow: 1 }}>
                {task.attachments?.slice(0, 3).map(att => {
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
                {task.attachments && task.attachments.length > 3 && (
                  <button 
                    onClick={() => setIsManagingAttachments(true)}
                    className="text-[10px] text-slate-400 hover:text-blue-500 px-1"
                  >
                    +{task.attachments.length - 3}
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
                  {task.attachments && task.attachments.length > 0 && (
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
                />
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

      {isManagingAttachments && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">管理附件 ({task.attachments?.length || 0})</h3>
              <button onClick={() => setIsManagingAttachments(false)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 grid grid-cols-3 gap-3">
              {task.attachments?.map(att => {
                const isImage = att.type.startsWith('image/');
                const url = URL.createObjectURL(att.data);
                const isSelected = selectedAttachments.includes(att.id);
                return (
                  <div 
                    key={att.id}
                    className={cn(
                      "relative aspect-square rounded-lg border-2 overflow-hidden cursor-pointer group",
                      isSelected ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-100 hover:border-slate-200"
                    )}
                    onClick={() => toggleAttachmentSelection(att.id)}
                  >
                    {isImage ? (
                      <img src={url} alt={att.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 p-2">
                        <FileText className="w-8 h-8 text-slate-400 mb-1" />
                        <span className="text-[10px] text-slate-500 truncate w-full text-center">{att.name}</span>
                      </div>
                    )}
                    <div className={cn(
                      "absolute top-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                      isSelected ? "bg-blue-500 border-blue-500 text-white" : "bg-white/80 border-slate-300"
                    )}>
                      {isSelected && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
              <button 
                onClick={deleteSelectedAttachments}
                disabled={selectedAttachments.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                删除选中 ({selectedAttachments.length})
              </button>
              <button 
                onClick={() => setIsManagingAttachments(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditingRichText && (
        <RichTextEditorModal
          initialContent={task.notes || ''}
          onSave={async (content) => {
            await db.tasks.update(task.id, { notes: content });
            setIsEditingRichText(false);
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
