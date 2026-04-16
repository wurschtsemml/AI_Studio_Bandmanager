import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserProfile, Song, Gig } from '../types';
import { Music, MapPin, Calendar, Star, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, isAfter, startOfToday, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

interface Props {
  profile: UserProfile | null;
}

export default function Dashboard({ profile }: Props) {
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);
  const [upcomingGigs, setUpcomingGigs] = useState<Gig[]>([]);
  const [possibleRehearsals, setPossibleRehearsals] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Songs with status > 3 (worse than 3)
    const songsQuery = query(
      collection(db, 'songs'), 
      where('isArchived', '!=', true),
      where('status', '>', 3)
    );
    
    const gigsQuery = query(
      collection(db, 'gigs'),
      where('isArchived', '!=', true),
      where('status', '==', 'Bestätigt'),
      orderBy('date', 'asc'),
      limit(5)
    );

    const unsubSongs = onSnapshot(songsQuery, (snapshot) => {
      setRecentSongs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Song)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'songs'));

    const unsubGigs = onSnapshot(gigsQuery, (snapshot) => {
      setUpcomingGigs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Gig)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'gigs'));

    // Fetch availabilities to find common free days
    const unsubAvail = onSnapshot(collection(db, 'availability'), (availSnap) => {
      onSnapshot(collection(db, 'users'), (usersSnap) => {
        const users = usersSnap.docs.map(d => d.data() as UserProfile);
        const avails = availSnap.docs.map(d => d.data());
        
        if (users.length === 0) return;

        // Group by date
        const dateGroups: Record<string, string[]> = {};
        avails.forEach(a => {
          if (a.status === 'available') {
            if (!dateGroups[a.date]) dateGroups[a.date] = [];
            dateGroups[a.date].push(a.userId);
          }
        });

        const today = startOfToday();
        const commonDates = Object.keys(dateGroups)
          .filter(date => {
            const isFuture = isAfter(parseISO(date), today) || date === format(today, 'yyyy-MM-dd');
            return isFuture && dateGroups[date].length === users.length;
          })
          .sort()
          .slice(0, 5);

        setPossibleRehearsals(commonDates);
        setLoading(false);
      });
    });

    return () => {
      unsubSongs();
      unsubGigs();
      unsubAvail();
    };
  }, []);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Willkommen zurück, {profile?.name}!</h1>
        <p className="text-gray-500">Hier ist eine Übersicht über die aktuellen Band-Aktivitäten.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Quick Stats */}
        <Card className="bg-indigo-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Deine Rolle</CardTitle>
            <Star className="h-4 w-4 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{profile?.role}</div>
            <p className="text-xs opacity-70">Berechtigungsstufe</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-600 text-white col-span-1 md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Nächstmögliche Proben</CardTitle>
            <CheckCircle2 className="h-4 w-4 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {possibleRehearsals.length === 0 ? (
                <p className="text-sm opacity-90 italic">Keine gemeinsamen Termine gefunden.</p>
              ) : (
                possibleRehearsals.map(date => (
                  <Badge key={date} variant="secondary" className="bg-white/20 text-white border-none px-3 py-1">
                    {format(parseISO(date), 'eeee, dd.MM.', { locale: de })}
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Songs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              Nacharbeit nötig
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSongs.length === 0 ? (
                <p className="text-gray-500 text-sm italic">Keine Songs gefunden.</p>
              ) : (
                recentSongs.map(song => (
                  <div key={song.id} className="flex flex-col p-3 bg-gray-50 rounded-lg gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm">{song.title}</p>
                        <p className="text-xs text-gray-500">{song.artist}</p>
                      </div>
                      <Badge variant="outline" className="bg-white">
                        Note: {song.status}
                      </Badge>
                    </div>
                    {song.notes && (
                      <p className="text-xs text-gray-600 bg-white/50 p-2 rounded border border-gray-100 italic">
                        {song.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Gigs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Nächste Gigs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingGigs.length === 0 ? (
                <p className="text-gray-500 text-sm italic">Keine bestätigten Gigs.</p>
              ) : (
                upcomingGigs.map(gig => (
                  <div key={gig.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-bold text-sm">{gig.name}</p>
                      <p className="text-xs text-gray-500">{gig.date || 'Datum offen'}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none">
                      Bestätigt
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
