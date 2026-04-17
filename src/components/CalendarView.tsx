import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, setDoc, doc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
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
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  profile: UserProfile | null;
}

export default function CalendarView({ profile }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
          <p className="text-muted-foreground text-sm">Tippe auf einen Tag, um deine Verfügbarkeit zu ändern.</p>
        </div>
        <div className="flex items-center gap-2 bg-card p-1 rounded-lg border shadow-sm self-start">
          <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft /></Button>
          <span className="font-bold min-w-[120px] text-center capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: de })}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight /></Button>
        </div>
      </header>

      <Card className="overflow-hidden shadow-md border-none sm:border">
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
              <div key={day} className="py-2 text-center text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const isCurrentMonth = format(day, 'MM') === format(currentDate, 'MM');
              const isToday = isSameDay(day, new Date());
              
              const bandStatus = allUsers.map(u => getStatus(day, u.uid));
              const hasUnavailable = bandStatus.some(s => s === 'unavailable');
              const hasAvailable = bandStatus.some(s => s === 'available');

              return (
                <div 
                  key={i} 
                  onClick={() => toggleStatus(day)}
                  className={`
                    aspect-square sm:aspect-auto sm:min-h-[120px] border-r border-b p-1 sm:p-2 transition-all relative cursor-pointer
                    ${!isCurrentMonth ? 'bg-muted/5 opacity-30 pointer-events-none' : 'hover:bg-accent/50'}
                    ${hasUnavailable ? 'bg-destructive/15' : 
                      hasAvailable ? 'bg-emerald-500/15' : ''}
                    ${isToday ? 'ring-1 ring-inset ring-primary/20' : ''}
                  `}
                >
                  <div className="h-full flex flex-col items-center justify-center sm:items-start sm:justify-start">
                    <span className={`
                      text-sm sm:text-base font-medium w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full transition-colors
                      ${isToday ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-foreground'}
                    `}>
                      {format(day, 'd')}
                    </span>

                    {/* Band status dots (mobile & desktop) */}
                    <div className="mt-auto sm:mt-2 flex flex-wrap gap-0.5 justify-center sm:justify-start h-2 sm:h-auto overflow-hidden">
                      {allUsers.map((u) => {
                        const status = getStatus(day, u.uid);
                        if (status === 'neutral') return null;
                        return (
                          <div 
                            key={u.uid} 
                            className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${getDayColor(status)}`} 
                            title={`${u.name}: ${status}`}
                          />
                        );
                      })}
                    </div>
                    
                    {/* Desktop name list */}
                    <div className="hidden sm:block mt-1.5 space-y-0.5 overflow-hidden w-full">
                      {allUsers.map((u) => {
                        const status = getStatus(day, u.uid);
                        return (
                          <div key={u.uid} className="flex items-center gap-1.5 group">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getDayColor(status)}`} />
                            <span className="text-[10px] text-muted-foreground truncate leading-tight group-hover:text-foreground">
                              {u.name.split(' ')[0]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Visual border for status on mobile */}
                  {hasUnavailable && (
                    <div className="absolute top-0 right-0 w-1 h-1 bg-destructive rounded-bl-full md:hidden" />
                  )}
                  {hasAvailable && !hasUnavailable && (
                    <div className="absolute top-0 right-0 w-1 h-1 bg-emerald-500 rounded-bl-full md:hidden" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      <div className="flex flex-wrap gap-4 pt-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span>Probe möglich</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-full bg-destructive" />
          <span>Einer abgesagt</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-full bg-muted" />
          <span>Kein Status</span>
        </div>
      </div>
    </div>
  );
}
