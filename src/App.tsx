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
import RehearsalPlanner from './components/RehearsalPlanner';
import TodoManager from './components/TodoManager';
import { useTheme } from './components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Lock,
  ListTodo,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';

type View = 'dashboard' | 'calendar' | 'setlist' | 'gigs' | 'admin' | 'settings' | 'rehearsals' | 'todos';

export default function App() {
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [initialRehearsalDate, setInitialRehearsalDate] = useState<string | null>(null);
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
            const userData = docSnap.data() as UserProfile;
            setProfile(userData);
            // Update last login even for session restore to keep it fresh
            await setDoc(doc(db, 'users', userData.uid), {
              ...userData,
              lastLogin: new Date().toISOString()
            });
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
        const updatedProfile = {
          ...userData,
          lastLogin: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', userData.uid), updatedProfile);
        setProfile(updatedProfile);
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <div className="w-full max-w-md p-8 bg-card rounded-2xl shadow-xl border">
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
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <Music className="h-8 w-8" />
                </div>
              )}
            </div>
            <h1 className="text-3xl font-bold mb-2 text-foreground">{bandSettings.bandName || 'Band Manager'}</h1>
            <p className="text-muted-foreground">Bitte melde dich mit deinen Zugangsdaten an.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Benutzername</Label>
              <Input 
                id="username" 
                type="text" 
                placeholder="z.B. max" 
                value={username || ''}
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
                value={password || ''}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="lg" className="w-full py-6 text-lg" disabled={isLoggingIn}>
              {isLoggingIn ? 'Anmeldung...' : 'Anmelden'}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-xs text-muted-foreground/50">
            Passwort vergessen? Bitte kontaktiere deinen Band-Admin.
          </div>
        </div>
      </div>
    );
  }

  const navGroups = [
    { id: 'dashboard', label: 'Übersicht', icon: LayoutDashboard },
    {
      title: 'Management',
      items: [
        { id: 'calendar', label: 'Verfügbarkeit', icon: Calendar },
        { id: 'rehearsals', label: 'Proben-Planer', icon: Calendar },
        { id: 'gigs', label: 'Gig-Planer', icon: MapPin },
      ]
    },
    {
      title: 'Inhalte',
      items: [
        { id: 'setlist', label: 'Setlist', icon: Music },
        { id: 'todos', label: "ToDo's", icon: ListTodo },
      ]
    },
    {
      title: 'System',
      items: [
        ...(profile?.role === 'admin' ? [{ id: 'admin', label: 'Admin', icon: Users }] : []),
        { id: 'settings', label: 'Einstellungen', icon: Settings },
      ]
    }
  ];

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return (
        <Dashboard 
          profile={profile} 
          onPlanRehearsal={(date) => {
            setInitialRehearsalDate(date);
            setCurrentView('rehearsals');
          }} 
        />
      );
      case 'calendar': return <CalendarView profile={profile} />;
      case 'setlist': return <Setlist profile={profile} />;
      case 'gigs': return <GigPlanner profile={profile} />;
      case 'rehearsals': return <RehearsalPlanner profile={profile} initialDate={initialRehearsalDate} />;
      case 'todos': return <TodoManager profile={profile} />;
      case 'admin': 
        if (profile?.role !== 'admin') {
          setCurrentView('dashboard');
          return (
            <Dashboard 
              profile={profile} 
              onPlanRehearsal={(date) => {
                setInitialRehearsalDate(date);
                setCurrentView('rehearsals');
              }} 
            />
          );
        }
        return <AdminPanel profile={profile} />;
      case 'settings': return (
        <div className="space-y-6">
          <header>
            <h1 className="text-3xl font-bold text-foreground">Einstellungen</h1>
            <p className="text-muted-foreground">Verwalte dein Profil, dein Passwort und das Erscheinungsbild.</p>
          </header>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-primary" />
                  Erscheinungsbild
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Farbschema</Label>
                  <Select value={theme} onValueChange={(val: any) => setTheme(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Thema wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <div className="flex items-center gap-2">
                          <Sun className="h-4 w-4" /> Hell
                        </div>
                      </SelectItem>
                      <SelectItem value="dark">
                        <div className="flex items-center gap-2">
                          <Moon className="h-4 w-4" /> Dunkel
                        </div>
                      </SelectItem>
                      <SelectItem value="system">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4" /> System
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
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
                      value={newPassword || ''}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit">Passwort aktualisieren</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      );
      default: return (
        <Dashboard 
          profile={profile} 
          onPlanRehearsal={(date) => {
            setInitialRehearsalDate(date);
            setCurrentView('rehearsals');
          }} 
        />
      );
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col md:flex-row">
        {/* Mobile Nav */}
        <div className="md:hidden bg-card border-b p-4 flex items-center justify-between sticky top-0 z-50">
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
          fixed inset-0 z-40 bg-card border-r transition-transform md:relative md:translate-x-0
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

          <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
            {navGroups.map((group) => (
              <div key={group.title || group.id} className="space-y-1">
                {group.title && (
                  <h3 className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    {group.title}
                  </h3>
                )}
                {group.items ? (
                  group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentView(item.id as View);
                        setIsMenuOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all
                        ${currentView === item.id 
                          ? 'bg-primary text-primary-foreground shadow-md' 
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}
                      `}
                    >
                      <item.icon className="h-4.5 w-4.5" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  ))
                ) : (
                  <button
                    onClick={() => {
                      setCurrentView(group.id as View);
                      setIsMenuOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                      ${currentView === group.id 
                        ? 'bg-primary text-primary-foreground shadow-md' 
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}
                    `}
                  >
                    <group.icon className="h-5 w-5" />
                    <span className="font-medium">{group.label}</span>
                  </button>
                )}
              </div>
            ))}
          </nav>

          <div className="p-4 border-t bg-muted/30">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {profile?.name?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate text-foreground">{profile?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{profile?.username}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
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
