import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, setDoc, doc, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserProfile, Availability, AvailabilityStatus } from '../types';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  getDay,
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Info, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  profile: UserProfile | null;
}

export default function CalendarView({ profile }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all availabilities for the current month roughly
    const unsubAvail = onSnapshot(collection(db, 'availability'), (snapshot) => {
      setAvailabilities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Availability)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'availability'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    return () => {
      unsubAvail();
      unsubUsers();
    };
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const getStatus = (date: Date, userId: string): AvailabilityStatus => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const found = availabilities.find(a => a.userId === userId && a.date === dateStr);
    return found ? found.status : 'neutral';
  };

  const toggleStatus = async (date: Date) => {
    if (!profile) {
      toast.error('Profil nicht geladen. Bitte kurz warten.');
      return;
    }
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const currentStatus = getStatus(date, profile.uid);
    
    let nextStatus: AvailabilityStatus = 'neutral';
    if (currentStatus === 'neutral') nextStatus = 'available';
    else if (currentStatus === 'available') nextStatus = 'unavailable';
    else nextStatus = 'neutral';

    const id = `${profile.uid}_${dateStr}`;
    try {
      await setDoc(doc(db, 'availability', id), {
        userId: profile.uid,
        date: dateStr,
        status: nextStatus
      });
      // No toast needed for every click, it's real-time
    } catch (error) {
      console.error('Error toggling status:', error);
      handleFirestoreError(error, OperationType.WRITE, `availability/${id}`);
    }
  };

  const getDayColor = (status: AvailabilityStatus) => {
    switch (status) {
      case 'available': return 'bg-emerald-500';
      case 'unavailable': return 'bg-destructive';
      default: return 'bg-muted';
    }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Verfügbarkeit</h1>
          <p className="text-muted-foreground">Klicke auf einen Tag, um deinen Status zu ändern. Die Punkte zeigen die Band-Übersicht.</p>
        </div>
        <div className="flex items-center gap-2 bg-card p-1 rounded-lg border shadow-sm">
          <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft /></Button>
          <span className="font-bold min-w-[120px] text-center capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: de })}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight /></Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8">
        {/* Calendar Grid */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b bg-muted/50">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                <div key={day} className="py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                const isCurrentMonth = format(day, 'MM') === format(currentDate, 'MM');
                const isToday = isSameDay(day, new Date());
                
                // Band overview for this day
                const bandStatus = allUsers.map(u => ({
                  uid: u.uid,
                  name: u.name,
                  instrument: u.instrument,
                  status: getStatus(day, u.uid)
                }));

                const allAvailable = allUsers.length > 0 && bandStatus.every(s => s.status === 'available');
                const myStatus = profile ? getStatus(day, profile.uid) : 'neutral';

                return (
                  <div 
                    key={i} 
                    onClick={() => toggleStatus(day)}
                    className={`
                      min-h-[120px] border-r border-b p-2 transition-all relative cursor-pointer
                      ${!isCurrentMonth ? 'bg-muted/30 opacity-40' : 'hover:bg-muted/20'}
                      ${allAvailable ? 'bg-emerald-500/10 ring-2 ring-inset ring-emerald-500/20' : 
                        myStatus === 'available' ? 'bg-emerald-500/5' : 
                        myStatus === 'unavailable' ? 'bg-destructive/5' : ''}
                    `}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`
                        text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                        ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}
                      `}>
                        {format(day, 'd')}
                      </span>
                    </div>

                    {/* Global Band Status List */}
                    <div className="space-y-1 overflow-hidden">
                      {bandStatus.map((s) => (
                        <div key={s.uid} className="flex items-center gap-1.5 group">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${getDayColor(s.status)}`} />
                          <span className="text-[10px] text-muted-foreground truncate leading-none">
                            {s.name.split(' ')[0]} {s.instrument ? `(${s.instrument})` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
