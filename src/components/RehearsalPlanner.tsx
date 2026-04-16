import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, getDocs, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserProfile, Song, Rehearsal } from '../types';
import { Calendar, Music, CheckSquare, Plus, Trash2, Edit2, ChevronRight, ListTodo, CheckCircle2, Circle, Clock, MapPin, Info } from 'lucide-react';
import { format, parseISO, isAfter, startOfToday, isBefore, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { RehearsalCard } from './RehearsalCard';

interface Props {
  profile: UserProfile | null;
  initialDate?: string | null;
}

export default function RehearsalPlanner({ profile, initialDate }: Props) {
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(!!initialDate);
  const [editingRehearsal, setEditingRehearsal] = useState<Rehearsal | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Rehearsal>>({
    date: initialDate || format(new Date(), 'yyyy-MM-dd'),
    time: '19:00',
    location: '',
    notes: '',
    songIds: [],
    todos: []
  });

  const [newTodo, setNewTodo] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'rehearsals'), where('isArchived', '!=', true), orderBy('date', 'asc'));
    const unsubRehearsals = onSnapshot(q, (snapshot) => {
      setRehearsals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Rehearsal)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'rehearsals'));

    const unsubSongs = onSnapshot(collection(db, 'songs'), (snapshot) => {
      setSongs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Song)));
    });

    return () => {
      unsubRehearsals();
      unsubSongs();
    };
  }, []);

  const handleSave = async () => {
    if (!formData.date) {
      toast.error('Bitte ein Datum angeben');
      return;
    }

    try {
      let rehearsalId = editingRehearsal?.id;
      if (rehearsalId) {
        await updateDoc(doc(db, 'rehearsals', rehearsalId), formData);
        toast.success('Probe aktualisiert');
      } else {
        const docRef = await addDoc(collection(db, 'rehearsals'), {
          ...formData,
          isArchived: false,
          createdAt: new Date().toISOString()
        });
        rehearsalId = docRef.id;
        toast.success('Probe geplant');
      }

      // Sync todos to global collection
      if (rehearsalId && formData.todos) {
        const todosRef = collection(db, 'todos');
        const q = query(todosRef, where('rehearsalId', '==', rehearsalId));
        const existingSnap = await getDocs(q);
        const batch = writeBatch(db);

        existingSnap.docs.forEach(d => batch.delete(d.ref));

        formData.todos.forEach(t => {
          const newTodoRef = doc(todosRef);
          batch.set(newTodoRef, {
            task: t.task,
            completed: t.completed,
            category: 'rehearsal',
            rehearsalId: rehearsalId,
            rehearsalDate: formData.date,
            createdAt: new Date().toISOString()
          });
        });
        await batch.commit();
      }

      setIsAddOpen(false);
      setEditingRehearsal(null);
      setFormData({ 
        date: format(new Date(), 'yyyy-MM-dd'), 
        time: '19:00',
        location: '',
        notes: '', 
        songIds: [], 
        todos: [] 
      });
    } catch (error) {
      toast.error('Fehler beim Speichern');
    }
  };

  const toggleTodo = async (rehearsal: Rehearsal, todoId: string) => {
    const todo = rehearsal.todos?.find(t => t.id === todoId);
    if (!todo) return;

    const updatedTodos = rehearsal.todos?.map(t => 
      t.id === todoId ? { ...t, completed: !t.completed } : t
    );
    try {
      await updateDoc(doc(db, 'rehearsals', rehearsal.id!), { todos: updatedTodos });
      
      const q = query(collection(db, 'todos'), where('rehearsalId', '==', rehearsal.id), where('task', '==', todo.task));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, { completed: !todo.completed });
      }
    } catch (e) {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const addTodo = () => {
    if (!newTodo.trim()) return;
    const todo = {
      id: Math.random().toString(36).substr(2, 9),
      task: newTodo.trim(),
      completed: false
    };
    setFormData({
      ...formData,
      todos: [...(formData.todos || []), todo]
    });
    setNewTodo('');
  };

  const removeTodo = (id: string) => {
    setFormData({
      ...formData,
      todos: formData.todos?.filter(t => t.id !== id)
    });
  };

  const toggleSong = (songId: string) => {
    const currentIds = formData.songIds || [];
    if (currentIds.includes(songId)) {
      setFormData({ ...formData, songIds: currentIds.filter(id => id !== songId) });
    } else {
      setFormData({ ...formData, songIds: [...currentIds, songId] });
    }
  };

  const deleteRehearsal = async (id: string) => {
    try {
      await updateDoc(doc(db, 'rehearsals', id), { isArchived: true });
      toast.success('Probe entfernt');
    } catch (e) {
      toast.error('Fehler beim Löschen');
    }
  };

  const today = startOfToday();
  const upcoming = rehearsals.filter(r => isAfter(parseISO(r.date), today) || isSameDay(parseISO(r.date), today));
  const past = rehearsals.filter(r => isBefore(parseISO(r.date), today) && !isSameDay(parseISO(r.date), today)).reverse();
  
  const nextRehearsal = upcoming[0];
  const otherUpcoming = upcoming.slice(1);

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Proben-Planer</h1>
          <p className="text-gray-500">Strukturiere deine Band-Proben und Ziele.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) {
            setEditingRehearsal(null);
            setFormData({ 
              date: format(new Date(), 'yyyy-MM-dd'), 
              time: '19:00',
              location: '',
              notes: '', 
              songIds: [], 
              todos: [] 
            });
          }
        }}>
          <DialogTrigger render={
            <Button className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              Probe planen
            </Button>
          } />
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRehearsal ? 'Probe bearbeiten' : 'Neue Probe planen'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="font-bold">Datum</Label>
                  <Input 
                    id="date" 
                    type="date" 
                    value={formData.date || ''} 
                    onChange={e => setFormData({...formData, date: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time" className="font-bold">Uhrzeit</Label>
                  <Input 
                    id="time" 
                    type="time" 
                    value={formData.time || ''} 
                    onChange={e => setFormData({...formData, time: e.target.value})} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="font-bold">Ort / Proberaum</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    id="location" 
                    placeholder="z.B. Proberaum Hersbruck" 
                    value={formData.location || ''} 
                    onChange={e => setFormData({...formData, location: e.target.value})} 
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <Music className="h-4 w-4 text-primary" /> Songs für diese Probe
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-3 bg-gray-50 rounded-xl border">
                  {songs.filter(s => !s.isArchived).map(song => (
                    <div 
                      key={song.id}
                      onClick={() => toggleSong(song.id!)}
                      className={`
                        flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all
                        ${formData.songIds?.includes(song.id!) 
                          ? 'bg-white border-primary shadow-sm ring-1 ring-primary/20' 
                          : 'bg-white/50 border-transparent hover:bg-white hover:border-gray-200'}
                      `}
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${formData.songIds?.includes(song.id!) ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}>
                        {formData.songIds?.includes(song.id!) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <div className="text-[10px] truncate">
                        <div className="font-bold text-gray-900">{song.title}</div>
                        <div className="text-gray-500">{song.artist}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-primary" /> To-Dos / Ziele
                </Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Neues To-Do..." 
                    value={newTodo || ''} 
                    onChange={e => setNewTodo(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTodo()}
                  />
                  <Button type="button" variant="secondary" onClick={addTodo}>Hinzufügen</Button>
                </div>
                <div className="space-y-2">
                  {formData.todos?.map(todo => (
                    <div key={todo.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg group border border-transparent hover:border-gray-200 transition-all">
                      <span className="text-sm text-gray-700">{todo.task}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeTodo(todo.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="font-bold">Anmerkungen</Label>
                <textarea 
                  id="notes"
                  className="flex min-h-[100px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  placeholder="Zusätzliche Infos zur Probe..."
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Abbrechen</Button>
              <Button onClick={handleSave} className="px-8">Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="space-y-12">
        {/* Upcoming Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Anstehende Proben</h2>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {upcoming.length === 0 ? (
            <Card className="border-dashed bg-gray-50/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Calendar className="h-12 w-12 mb-4 opacity-10" />
                <p className="font-medium">Keine anstehenden Proben geplant.</p>
                <Button variant="link" onClick={() => setIsAddOpen(true)} className="text-primary mt-2">
                  Jetzt die erste Probe planen
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {nextRehearsal && (
                <div className="max-w-2xl mx-auto">
                  <RehearsalCard 
                    rehearsal={nextRehearsal} 
                    songs={songs}
                    isNext={true} 
                    onEdit={(r) => {
                      setEditingRehearsal(r);
                      setFormData(r);
                      setIsAddOpen(true);
                    }}
                    onDelete={deleteRehearsal}
                    onToggleTodo={toggleTodo}
                  />
                </div>
              )}
              
              {otherUpcoming.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {otherUpcoming.map(r => (
                    <RehearsalCard 
                      key={r.id} 
                      rehearsal={r} 
                      songs={songs}
                      onEdit={(r) => {
                        setEditingRehearsal(r);
                        setFormData(r);
                        setIsAddOpen(true);
                      }}
                      onDelete={deleteRehearsal}
                      onToggleTodo={toggleTodo}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Past Section */}
        {past.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="h-px flex-1 bg-gray-100" />
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-300">Vergangene Proben</h2>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowPast(!showPast)}
                className="text-gray-400 text-xs hover:text-gray-600"
              >
                {showPast ? 'Ausblenden' : 'Anzeigen'}
              </Button>
            </div>

            <AnimatePresence>
              {showPast && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden"
                >
                  {past.map(r => (
                    <Card key={r.id} className="opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-500">
                            {format(parseISO(r.date), 'dd.MM.yyyy')}
                          </span>
                          <Badge variant="outline" className="text-[8px] py-0 h-4">Vergangen</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            setEditingRehearsal(r);
                            setFormData(r);
                            setIsAddOpen(true);
                          }}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}
      </div>
    </div>
  );
}
