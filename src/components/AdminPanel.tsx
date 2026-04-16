import { useState, useEffect, ChangeEvent } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
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
import { BandSettings, UserProfile, UserRole } from '../types';
import { Shield, Trash2, UserCog, Mail, ShieldCheck, Plus, UserPlus, Image as ImageIcon, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  profile: UserProfile | null;
}

export default function AdminPanel({ profile }: Props) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Form state for adding/editing members
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    name: '',
    username: '',
    role: 'user',
    instrument: ''
  });

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [bandSettings, setBandSettings] = useState<BandSettings>({ logoUrl: '', bandName: 'Band Manager' });
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const unsubSettings = onSnapshot(doc(db, 'settings', 'band'), (snapshot) => {
      if (snapshot.exists()) {
        setBandSettings(snapshot.data() as BandSettings);
      }
    });

    return () => {
      unsubUsers();
      unsubSettings();
    };
  }, []);

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) { // 500KB limit for Base64 in Firestore
      toast.error('Das Logo ist zu groß (max. 500KB erlaubt)');
      return;
    }

    setIsUploadingLogo(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await setDoc(doc(db, 'settings', 'band'), { ...bandSettings, logoUrl: base64String }, { merge: true });
        toast.success('Logo erfolgreich aktualisiert');
      } catch (error) {
        console.error('Logo upload error:', error);
        toast.error('Fehler beim Speichern des Logos');
      } finally {
        setIsUploadingLogo(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUser = async () => {
    const trimmedUsername = formData.username?.trim().toLowerCase();
    const trimmedName = formData.name?.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedName) {
      toast.error('Name und Benutzername sind Pflichtfelder');
      return;
    }

    if (!editingUser && (!trimmedPassword || trimmedPassword.length < 4)) {
      toast.error('Passwort muss mindestens 4 Zeichen lang sein');
      return;
    }

    setIsSaving(true);
    try {
      const uid = editingUser?.uid || `user_${Date.now()}`;
      
      const userToSave = {
        ...formData,
        uid: uid,
        name: trimmedName,
        username: trimmedUsername,
        role: formData.role as UserRole,
        instrument: formData.instrument?.trim() || '',
        ...(trimmedPassword ? { password: trimmedPassword } : {})
      };

      await setDoc(doc(db, 'users', uid), userToSave);
      toast.success(editingUser ? 'Mitglied aktualisiert' : 'Mitglied hinzugefügt');
      setIsAddOpen(false);
      setEditingUser(null);
      setPassword('');
      setFormData({ name: '', username: '', role: 'user', instrument: '' });
    } catch (error) {
      console.error('Save user error:', error);
      toast.error('Fehler beim Speichern des Benutzers');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRole = async (user: UserProfile) => {
    if (user.uid === profile?.uid) {
      toast.error('Du kannst deine eigene Rolle nicht ändern.');
      return;
    }

    const nextRole: UserRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: nextRole });
      toast.success(`Rolle für ${user.name} auf ${nextRole} geändert`);
    } catch (error) {
      console.error('Toggle role error:', error);
      toast.error('Fehler beim Ändern der Rolle');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete.uid === profile?.uid) {
      toast.error('Du kannst dich nicht selbst löschen.');
      return;
    }

    const toastId = toast.loading(`${userToDelete.name} wird gelöscht...`);
    try {
      console.log('Attempting to delete user:', userToDelete.uid);
      await deleteDoc(doc(db, 'users', userToDelete.uid));
      console.log('User deleted successfully');
      toast.success('Benutzer entfernt', { id: toastId });
      setIsDeleteOpen(false);
      setUserToDelete(null);
    } catch (error) {
      console.error('Delete user error:', error);
      toast.error('Fehler beim Löschen des Benutzers', { id: toastId });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin-Bereich</h1>
          <p className="text-gray-500">Verwalte die Band-Einstellungen und Mitglieder.</p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger render={
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Mitglied hinzufügen
              </Button>
            } />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUser ? 'Mitglied bearbeiten' : 'Neuen Song hinzufügen'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="username" className="text-right">Benutzername</Label>
                  <Input id="username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="col-span-3" placeholder="z.B. max" disabled={!!editingUser} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="pass" className="text-right">
                    {editingUser ? 'Neues PW' : 'Passwort'}
                  </Label>
                  <Input 
                    id="pass" 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="col-span-3" 
                    placeholder={editingUser ? 'Leer lassen zum Behalten' : 'Mind. 4 Zeichen'} 
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="instrument" className="text-right">Instrument</Label>
                  <Input id="instrument" value={formData.instrument} onChange={e => setFormData({...formData, instrument: e.target.value})} className="col-span-3" placeholder="z.B. Gitarre, Drums" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="role" className="text-right">Rolle</Label>
                  <div className="col-span-3">
                    <Select value={formData.role} onValueChange={(val: UserRole) => setFormData({...formData, role: val})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Rolle wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Mitglied (User)</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsAddOpen(false);
                  setEditingUser(null);
                  setPassword('');
                }}>Abbrechen</Button>
                <Button onClick={handleSaveUser} disabled={isSaving}>
                  {isSaving ? 'Speichert...' : 'Speichern'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Bandmitglieder
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>Mitglied</TableHead>
                      <TableHead>Instrument</TableHead>
                      <TableHead>Rolle</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.uid}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {u.name[0]}
                            </div>
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {u.name}
                                {u.uid === profile?.uid && (
                                  <Badge variant="outline" className="text-[10px] py-0 h-4">Du</Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-400 flex items-center gap-1">
                                <UserCog className="h-2.5 w-2.5" /> {u.username}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{u.instrument || '-'}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`
                            ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-100 text-gray-700 border-gray-200'}
                          `}>
                            {u.role === 'admin' ? (
                              <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Admin</span>
                            ) : (
                              'User'
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="gap-1 h-8"
                              onClick={() => {
                                setEditingUser(u);
                                setFormData(u);
                                setIsAddOpen(true);
                              }}
                            >
                              <UserCog className="h-3.5 w-3.5" />
                              Bearbeiten
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => {
                                console.log('Delete requested for:', u.name, u.uid);
                                setUserToDelete(u);
                                setIsDeleteOpen(true);
                              }}
                              disabled={u.uid === profile?.uid}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                Band-Logo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl bg-gray-50 gap-4">
                {bandSettings.logoUrl ? (
                  <div className="relative group">
                    <img 
                      src={bandSettings.logoUrl} 
                      alt="Band Logo Preview" 
                      className="max-h-32 w-auto object-contain rounded shadow-sm"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                      <Label htmlFor="logo-upload" className="cursor-pointer text-white text-xs font-bold flex items-center gap-1">
                        <Upload className="h-3 w-3" /> Ändern
                      </Label>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <ImageIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Kein Logo hochgeladen</p>
                  </div>
                )}
                
                <div className="w-full">
                  <Input 
                    id="logo-upload" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                  />
                  <Button 
                    variant="outline" 
                    className="w-full gap-2" 
                    asChild
                    disabled={isUploadingLogo}
                  >
                    <Label htmlFor="logo-upload" className="cursor-pointer">
                      <Upload className="h-4 w-4" />
                      {isUploadingLogo ? 'Wird gespeichert...' : 'Logo hochladen'}
                    </Label>
                  </Button>
                  <p className="text-[10px] text-gray-400 mt-2 text-center">
                    Empfohlen: Transparentes PNG, max. 500KB.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="band-name">Band-Name</Label>
                <div className="flex gap-2">
                  <Input 
                    id="band-name" 
                    value={bandSettings.bandName || ''} 
                    onChange={e => setBandSettings({...bandSettings, bandName: e.target.value})}
                    placeholder="z.B. Roofpop"
                  />
                  <Button 
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await setDoc(doc(db, 'settings', 'band'), bandSettings, { merge: true });
                        toast.success('Band-Name aktualisiert');
                      } catch (e) {
                        toast.error('Fehler beim Speichern');
                      }
                    }}
                  >
                    OK
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 border-amber-200">
            <CardHeader>
              <CardTitle className="text-amber-800 text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Sicherheitshinweis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-amber-700">
                Admins haben vollen Zugriff auf alle Songs, Gigs und die Benutzerverwaltung. 
                Änderungen am Logo sind sofort für alle Mitglieder sichtbar.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer löschen</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            Möchtest du <strong>{userToDelete?.name}</strong> wirklich aus der Band-Verwaltung entfernen?
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDeleteUser}>Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
