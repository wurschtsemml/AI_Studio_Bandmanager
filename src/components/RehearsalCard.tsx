import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserProfile, Song, Rehearsal } from '../types';
import { Calendar, Music, Plus, Trash2, Edit2, ListTodo, CheckCircle2, Circle, Clock, Info, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { motion } from 'motion/react';

interface RehearsalCardProps {
  rehearsal: Rehearsal;
  songs: Song[];
  isNext?: boolean;
  onEdit: (r: Rehearsal) => void;
  onDelete: (id: string) => void | Promise<void>;
  onToggleTodo: (r: Rehearsal, id: string) => void | Promise<void>;
}

export const RehearsalCard: React.FC<RehearsalCardProps> = ({ 
  rehearsal, 
  songs, 
  isNext = false, 
  onEdit, 
  onDelete, 
  onToggleTodo 
}) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="group"
  >
    <Card className={`
      overflow-hidden transition-all duration-300 hover:shadow-lg
      ${isNext ? 'border-primary border-2 ring-4 ring-primary/5' : 'border-gray-200'}
    `}>
      <div className={`h-1.5 w-full ${isNext ? 'bg-primary' : 'bg-gray-200'}`} />
      <CardContent className="p-0">
        <div className="flex flex-col">
          {/* Header Section */}
          <div className={`p-5 flex items-start justify-between ${isNext ? 'bg-primary/5' : 'bg-gray-50/50'}`}>
            <div className="flex items-center gap-4">
              <div className={`
                w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold
                ${isNext ? 'bg-primary text-white' : 'bg-white border text-gray-600'}
              `}>
                <span className="text-[10px] uppercase leading-none mb-0.5">{format(parseISO(rehearsal.date), 'MMM', { locale: de })}</span>
                <span className="text-lg leading-none">{format(parseISO(rehearsal.date), 'dd')}</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">
                  {format(parseISO(rehearsal.date), 'EEEE', { locale: de })}
                </h3>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {isNext ? 'Nächste Probe' : 'Geplant'}
                </div>
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(rehearsal)}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => onDelete(rehearsal.id!)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="p-5 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rehearsal.time && (
                <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">{rehearsal.time} Uhr</span>
                </div>
              )}
              {rehearsal.location && (
                <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium truncate">{rehearsal.location}</span>
                </div>
              )}
            </div>

            {rehearsal.notes && (
              <div className="flex gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 italic">{rehearsal.notes}</p>
              </div>
            )}

            {/* Songs Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Music className="h-3 w-3" /> Songs ({rehearsal.songIds?.length || 0})
                </h4>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {rehearsal.songIds?.map(id => {
                  const song = songs.find(s => s.id === id);
                  return song ? (
                    <div key={id} className="flex items-center justify-between p-2 bg-white border rounded-lg text-xs group/song hover:border-primary/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                        <span className="font-bold truncate">{song.title}</span>
                        <span className="text-gray-400 truncate hidden sm:inline">- {song.artist}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] py-0 h-4 shrink-0">
                        Status {song.status}
                      </Badge>
                    </div>
                  ) : null;
                })}
                {(!rehearsal.songIds || rehearsal.songIds.length === 0) && (
                  <p className="text-[10px] text-gray-400 italic">Keine Songs ausgewählt</p>
                )}
              </div>
            </div>

            {/* To-Dos Section */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                <ListTodo className="h-3 w-3" /> To-Dos ({rehearsal.todos?.filter(t => t.completed).length || 0}/{rehearsal.todos?.length || 0})
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {rehearsal.todos?.map(todo => (
                  <div 
                    key={todo.id} 
                    className={`
                      flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border
                      ${todo.completed 
                        ? 'bg-gray-50/50 border-transparent' 
                        : 'bg-white border-gray-100 hover:border-primary/20 hover:shadow-sm'}
                    `}
                    onClick={() => onToggleTodo(rehearsal, todo.id)}
                  >
                    {todo.completed ? (
                      <CheckCircle2 className="h-4.5 w-4.5 text-green-500 shrink-0" />
                    ) : (
                      <Circle className="h-4.5 w-4.5 text-gray-300 group-hover/todo:text-primary shrink-0" />
                    )}
                    <span className={`text-xs ${todo.completed ? 'line-through text-gray-400' : 'text-gray-700 font-medium'} line-clamp-1`}>
                      {todo.task}
                    </span>
                  </div>
                ))}
                {(!rehearsal.todos || rehearsal.todos.length === 0) && (
                  <p className="text-[10px] text-gray-400 italic">Keine To-Dos hinterlegt</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);
