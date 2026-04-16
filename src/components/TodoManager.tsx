import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserProfile, Todo, Rehearsal } from '../types';
import { CheckCircle2, Circle, Plus, Trash2, ListTodo, Calendar, Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';

interface Props {
  profile: UserProfile | null;
}

export default function TodoManager({ profile }: Props) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'todos'), orderBy('createdAt', 'desc'));
    const unsubTodos = onSnapshot(q, (snapshot) => {
      setTodos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Todo)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'todos'));

    const unsubRehearsals = onSnapshot(collection(db, 'rehearsals'), (snapshot) => {
      setRehearsals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Rehearsal)));
    });

    return () => {
      unsubTodos();
      unsubRehearsals();
    };
  }, []);

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    try {
      await addDoc(collection(db, 'todos'), {
        task: newTodo.trim(),
        completed: false,
        category: 'general',
        createdAt: new Date().toISOString()
      });
      setNewTodo('');
      toast.success('Aufgabe hinzugefügt');
    } catch (error) {
      toast.error('Fehler beim Speichern');
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'todos', id));
      toast.success('Aufgabe gelöscht');
    } catch (e) {
      toast.error('Fehler beim Löschen');
    }
  };

  const generalTodos = todos.filter(t => t.category === 'general');
  
  // Derive rehearsal todos directly from rehearsals collection to ensure existing ones are shown
  const derivedRehearsalTodos: Todo[] = rehearsals.flatMap(rehearsal => 
    (rehearsal.todos || []).map(t => ({
      id: `${rehearsal.id}_${t.id}`,
      task: t.task,
      completed: t.completed,
      category: 'rehearsal' as const,
      rehearsalId: rehearsal.id,
      rehearsalDate: rehearsal.date,
      createdAt: rehearsal.date // Use date as fallback for sorting
    }))
  );

  const toggleTodo = async (todo: Todo) => {
    try {
      if (todo.category === 'rehearsal' && todo.rehearsalId) {
        const rehearsal = rehearsals.find(r => r.id === todo.rehearsalId);
        if (rehearsal) {
          // The ID in derivedRehearsalTodos is `${rehearsal.id}_${originalTodoId}`
          const originalTodoId = todo.id?.split('_')[1];
          const updatedRehearsalTodos = rehearsal.todos?.map(t => 
            t.id === originalTodoId ? { ...t, completed: !todo.completed } : t
          );
          await updateDoc(doc(db, 'rehearsals', todo.rehearsalId), { todos: updatedRehearsalTodos });
          
          // Also sync with global todos if it exists there (for backward compatibility/consistency)
          const q = query(collection(db, 'todos'), where('rehearsalId', '==', todo.rehearsalId), where('task', '==', todo.task));
          const snap = await getDocs(q);
          if (!snap.empty) {
            await updateDoc(snap.docs[0].ref, { completed: !todo.completed });
          }
        }
      } else {
        await updateDoc(doc(db, 'todos', todo.id!), { completed: !todo.completed });
      }
    } catch (e) {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-foreground">To-Do Liste</h1>
        <p className="text-muted-foreground">Verwalte allgemeine Aufgaben und Proben-Ziele.</p>
      </header>

      <div className="max-w-4xl">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general" className="gap-2">
              <ListTodo className="h-4 w-4" /> Allgemein
            </TabsTrigger>
            <TabsTrigger value="rehearsal" className="gap-2">
              <Calendar className="h-4 w-4" /> Aus Proben
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Neue Aufgabe</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Was ist zu tun? (z.B. Saiten kaufen, Setlist drucken...)" 
                    value={newTodo || ''} 
                    onChange={e => setNewTodo(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
                  />
                  <Button onClick={handleAddTodo}>Hinzufügen</Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {generalTodos.length === 0 ? (
                <div className="text-center py-12 bg-muted/50 rounded-xl border-2 border-dashed">
                  <p className="text-muted-foreground italic">Keine allgemeinen Aufgaben.</p>
                </div>
              ) : (
                generalTodos.map(todo => (
                  <Card key={todo.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div 
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => toggleTodo(todo)}
                      >
                        {todo.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
                        )}
                        <span className={`${todo.completed ? 'line-through text-muted-foreground' : 'text-foreground'} font-medium`}>
                          {todo.task}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => deleteTodo(todo.id!)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="rehearsal" className="space-y-4">
            {derivedRehearsalTodos.length === 0 ? (
              <div className="text-center py-12 bg-muted/50 rounded-xl border-2 border-dashed">
                <p className="text-muted-foreground italic">Keine Aufgaben aus Proben hinterlegt.</p>
                <p className="text-xs text-muted-foreground mt-2">Füge Aufgaben im Proben-Planer hinzu, um sie hier zu sehen.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Group by rehearsal date */}
                {Array.from(new Set(derivedRehearsalTodos.map(t => t.rehearsalDate))).sort().reverse().map(date => (
                  <div key={date as string} className="space-y-2">
                    <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2 px-1">
                      <Calendar className="h-4 w-4" />
                      Probe am {date ? format(parseISO(date as string), 'dd.MM.yyyy') : 'Unbekannt'}
                    </h3>
                    {derivedRehearsalTodos.filter(t => t.rehearsalDate === date).map(todo => (
                      <Card key={todo.id} className="hover:shadow-sm transition-shadow border-l-4 border-l-indigo-400">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div 
                            className="flex items-center gap-3 cursor-pointer flex-1"
                            onClick={() => toggleTodo(todo)}
                          >
                            {todo.completed ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
                            )}
                            <span className={`${todo.completed ? 'line-through text-muted-foreground' : 'text-foreground'} font-medium`}>
                              {todo.task}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                            Probe
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
