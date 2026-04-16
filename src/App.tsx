import { useState, useEffect, FormEvent } from 'react';
import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { BandSettings, UserProfile, UserRole } from './types';

// Components
import Dashboard from './components/Dashboard';
import CalendarView from './components/CalendarView';
import Setlist from './components/Setlist';
import GigPlanner from './components/GigPlanner';
import AdminPanel from './components/AdminPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LayoutDashboard, 
  Calendar, 
  Music, 
  MapPin, 
  Users, 
  LogOut, 
  Menu,
  X,
  Settings,
  Lock
} from 'lucide-react';

type View = 'dashboard' | 'calendar' | 'setlist' | 'gigs' | 'admin' | 'settings';

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [bandSettings, setBandSettings] = useState<BandSettings>({ logoUrl: '', bandName: 'Band Manager' });

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'band'), (snapshot) => {
      if (snapshot.exists()) {
        setBandSettings(snapshot.data() as BandSettings);
      }
    });

    const init = async () => {
      const checkInitialAdmin = async () => {
        try {
          const usersRef = collection(db, 'users');
          // Check specifically if 'flo' exists
          const q = query(usersRef, where('username', '==', 'flo'), limit(1));
          const snapshot = await getDocs(q);
          
          if (snapshot.empty) {
            const initialAdmin: UserProfile = {
              uid: 'admin_flo',
              username: 'flo',
              password: 'hersbruck',
              name: 'Flo',
              role: 'admin',
              instrument: ''
            };
            await setDoc(doc(db, 'users', initialAdmin.uid), initialAdmin);
            console.log('Initial admin user "flo" created');
          }
        } catch (error) {
          console.error('Error checking/creating initial admin:', error);
        }
      };
      
      await checkInitialAdmin();

      // Check for existing session
      const savedUser = localStorage.getItem('band_manager_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          // Refresh profile from DB to ensure roles/data are up to date
          const docRef = doc(db, 'users', parsed.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            localStorage.removeItem('band_manager_user');
          }
        } catch (e) {
          localStorage.removeItem('band_manager_user');
        }
      }
      setLoading(false);
    };

    init();
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      toast.error('Bitte Benutzername und Passwort eingeben');
      return;
    }
    setIsLoggingIn(true);
    try {
      const q = query(
        collection(db, 'users'), 
        where('username', '==', trimmedUsername),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        toast.error('Benutzername nicht gefunden');
        setIsLoggingIn(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data() as UserProfile;

      if (userData.password === trimmedPassword) {
        setProfile(userData);
        localStorage.setItem('band_manager_user', JSON.stringify({ uid: userData.uid }));
        toast.success('Erfolgreich angemeldet');
      } else {
        toast.error('Passwort falsch');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error('Login fehlgeschlagen');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      toast.error('Passwort muss mindestens 4 Zeichen lang sein');
      return;
    }
    if (!profile) return;

    try {
      await setDoc(doc(db, 'users', profile.uid), { 
        ...profile, 
        password: newPassword 
      });
      setProfile({ ...profile, password: newPassword });
      toast.success('Passwort erfolgreich geändert');
      setNewPassword('');
    } catch (error: any) {
      console.error('Password change error:', error);
      toast.error('Passwortänderung fehlgeschlagen');
    }
  };

  const handleLogout = () => {
    setProfile(null);
    localStorage.removeItem('band_manager_user');
    toast.success('Abgemeldet');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
          <div className="text-center mb-8">
            <div className="mb-4 inline-flex items-center justify-center">
              {bandSettings.logoUrl ? (
                <img 
                  src={bandSettings.logoUrl} 
                  alt="Band Logo" 
                  className="h-24 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Music className="h-8 w-8 text-primary" />
                </div>
              )}
            </div>
            <h1 className="text-3xl font-bold mb-2">{bandSettings.bandName || 'Band Manager'}</h1>
            <p className="text-gray-500">Bitte melde dich mit deinen Zugangsdaten an.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Benutzername</Label>
              <Input 
                id="username" 
                type="text" 
                placeholder="z.B. max" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="lg" className="w-full py-6 text-lg" disabled={isLoggingIn}>
              {isLoggingIn ? 'Anmeldung...' : 'Anmelden'}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-xs text-gray-400">
            Passwort vergessen? Bitte kontaktiere deinen Band-Admin.
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Übersicht', icon: LayoutDashboard },
    { id: 'calendar', label: 'Verfügbarkeit', icon: Calendar },
    { id: 'setlist', label: 'Setlist', icon: Music },
    { id: 'gigs', label: 'Gig-Planer', icon: MapPin },
    { id: 'settings', label: 'Einstellungen', icon: Settings },
    ...(profile?.role === 'admin' ? [{ id: 'admin', label: 'Admin', icon: Users }] : []),
  ];

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard profile={profile} onNavigate={setCurrentView} />;
      case 'calendar': return <CalendarView profile={profile} />;
      case 'setlist': return <Setlist profile={profile} />;
      case 'gigs': return <GigPlanner profile={profile} />;
      case 'admin': 
        if (profile?.role !== 'admin') {
          setCurrentView('dashboard');
          return <Dashboard profile={profile} onNavigate={setCurrentView} />;
        }
        return <AdminPanel profile={profile} />;
      case 'settings': return (
        <div className="space-y-6">
          <header>
            <h1 className="text-3xl font-bold text-gray-900">Einstellungen</h1>
            <p className="text-gray-500">Verwalte dein Profil und dein Passwort.</p>
          </header>
          
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Passwort ändern
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Neues Passwort</Label>
                  <Input 
                    id="new-password" 
                    type="password" 
                    placeholder="Mindestens 4 Zeichen" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit">Passwort aktualisieren</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      );
      default: return <Dashboard profile={profile} onNavigate={setCurrentView} />;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
        {/* Mobile Nav */}
        <div className="md:hidden bg-white border-b p-4 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-2 font-bold text-primary">
            {bandSettings.logoUrl ? (
              <img 
                src={bandSettings.logoUrl} 
                alt="Band Logo" 
                className="h-8 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <>
                <Music className="h-6 w-6" />
                <span>{bandSettings.bandName || 'Band Manager'}</span>
              </>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>

        {/* Sidebar */}
        <aside className={`
          fixed inset-0 z-40 bg-white border-r transition-transform md:relative md:translate-x-0
          ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          w-64 flex flex-col
        `}>
          <div className="p-6 hidden md:flex items-center justify-center border-b min-h-[100px]">
            {bandSettings.logoUrl ? (
              <img 
                src={bandSettings.logoUrl} 
                alt="Band Logo" 
                className="h-16 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex items-center gap-2 font-bold text-2xl text-primary">
                <Music className="h-8 w-8" />
                <span>{bandSettings.bandName || 'Band Manager'}</span>
              </div>
            )}
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id as View);
                  setIsMenuOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                  ${currentView === item.id 
                    ? 'bg-primary text-white shadow-md' 
                    : 'text-gray-600 hover:bg-gray-100'}
                `}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {profile?.name?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{profile?.name}</p>
                <p className="text-xs text-gray-500 truncate">{profile?.username}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Abmelden
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {renderView()}
          </div>
        </main>
      </div>
      <Toaster position="top-right" />
    </>
  );
}
