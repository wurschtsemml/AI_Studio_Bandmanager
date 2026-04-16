import { useState, useEffect } from 'react';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { BandSettings, UserProfile, Song } from '../types';
import { Music, Plus, Trash2, Archive, ExternalLink, FileAudio, Search, Edit2, ArrowUpDown, ArrowUp, ArrowDown, Calendar as CalendarIcon, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

interface Props {
  profile: UserProfile | null;
}

type SortField = 'title' | 'status' | 'lastPlayed' | 'playCount';
type SortOrder = 'asc' | 'desc';

export default function Setlist({ profile }: Props) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [bandSettings, setBandSettings] = useState<BandSettings>({});

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'band'), (snapshot) => {
      if (snapshot.exists()) {
        setBandSettings(snapshot.data() as BandSettings);
      }
    });
    return () => unsubSettings();
  }, []);

  // Form state
  const [formData, setFormData] = useState<Partial<Song>>({
    title: '',
    artist: '',
    status: 3,
    notes: '',
    youtubeLink: '',
    fileUrl: '',
    isArchived: false,
    lastPlayed: '',
    playCount: 0
  });

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'songs'));
    const unsub = onSnapshot(q, (snapshot) => {
      setSongs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Song)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'songs'));
    return unsub;
  }, []);

  const handleSave = async () => {
    if (!formData.title || !formData.artist) {
      toast.error('Titel und Interpret sind Pflichtfelder');
      return;
    }

    try {
      if (editingSong) {
        await updateDoc(doc(db, 'songs', editingSong.id!), formData);
        toast.success('Song aktualisiert');
      } else {
        await addDoc(collection(db, 'songs'), { ...formData, isArchived: false });
        toast.success('Song hinzugefügt');
      }
      setIsAddOpen(false);
      setEditingSong(null);
      setFormData({ title: '', artist: '', status: 3, notes: '', youtubeLink: '', fileUrl: '', isArchived: false, lastPlayed: '', playCount: 0 });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'songs');
    }
  };

  const handleDelete = async () => {
    if (!songToDelete?.id) return;
    
    const toastId = toast.loading('Song wird gelöscht...');
    try {
      await deleteDoc(doc(db, 'songs', songToDelete.id));
      toast.success('Song gelöscht', { id: toastId });
      setIsDeleteOpen(false);
      setSongToDelete(null);
    } catch (error) {
      console.error('Delete song error:', error);
      toast.error('Fehler beim Löschen', { id: toastId });
    }
  };

  const toggleArchive = async (song: Song) => {
    try {
      await updateDoc(doc(db, 'songs', song.id!), { isArchived: !song.isArchived });
      toast.success(song.isArchived ? 'Song reaktiviert' : 'Song archiviert');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `songs/${song.id}`);
    }
  };

  const handleFileUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileRef = ref(storage, `songs/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setFormData(prev => ({ ...prev, fileUrl: url }));
      toast.success('Datei hochgeladen');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  };

  const incrementPlayCount = async (song: Song) => {
    try {
      const newCount = (song.playCount || 0) + 1;
      const today = new Date().toISOString().split('T')[0];
      await updateDoc(doc(db, 'songs', song.id!), { 
        playCount: newCount,
        lastPlayed: today
      });
      toast.success(`Zähler für "${song.title}" erhöht`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `songs/${song.id}`);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const filteredSongs = songs
      .filter(s => showArchived ? s.isArchived : !s.isArchived)
      .filter(s => 
        s.title.toLowerCase().includes(search.toLowerCase()) || 
        s.artist.toLowerCase().includes(search.toLowerCase())
      );

    const logoHtml = bandSettings.logoUrl 
      ? `<img src="${bandSettings.logoUrl}" style="height: 60px; margin-bottom: 20px;">` 
      : '';

    const tableRows = filteredSongs.map(s => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${s.title}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${s.artist}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">Note: ${s.status}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${s.playCount || 0}x</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${s.lastPlayed ? format(parseISO(s.lastPlayed), 'dd.MM.yyyy') : '-'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Setlist - ${bandSettings.bandName || 'Band Manager'}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; background: #f4f4f4; padding: 10px; border-bottom: 2px solid #333; }
            h1 { margin: 0; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #eee; padding-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              ${logoHtml}
              <h1>Setlist: ${bandSettings.bandName || 'Band Manager'}</h1>
              <p>Stand: ${format(new Date(), 'dd.MM.yyyy')}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Titel</th>
                <th>Interpret</th>
                <th style="text-align: center;">Status</th>
                <th style="text-align: center;">Gespielt</th>
                <th>Zuletzt</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredSongs = songs
    .filter(s => {
      const matchesSearch = s.title.toLowerCase().includes(search.toLowerCase()) || 
                            s.artist.toLowerCase().includes(search.toLowerCase());
      const matchesArchive = showArchived ? s.isArchived : !s.isArchived;
      return matchesSearch && matchesArchive;
    })
    .sort((a, b) => {
      let valA: any = a[sortField] || '';
      let valB: any = b[sortField] || '';

      if (sortField === 'title') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const isAdmin = profile?.role === 'admin';

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortOrder === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Setlist</h1>
            <p className="text-gray-500">Verwalte das Repertoire der Band.</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Drucken
          </Button>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Song hinzufügen
            </Button>
          } />
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{editingSong ? 'Song bearbeiten' : 'Neuen Song hinzufügen'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4 overflow-y-auto pr-2">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="title" className="text-right">Titel</Label>
                  <Input id="title" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="artist" className="text-right">Interpret</Label>
                  <Input id="artist" value={formData.artist || ''} onChange={e => setFormData({...formData, artist: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="status" className="text-right">Status (1-6)</Label>
                  <Input id="status" type="number" min="1" max="6" value={formData.status ?? 3} onChange={e => setFormData({...formData, status: parseInt(e.target.value)})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="lastPlayed" className="text-right">Zuletzt gespielt</Label>
                  <Input id="lastPlayed" type="date" value={formData.lastPlayed || ''} onChange={e => setFormData({...formData, lastPlayed: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="playCount" className="text-right">Anzahl gespielt</Label>
                  <Input id="playCount" type="number" min="0" value={formData.playCount ?? 0} onChange={e => setFormData({...formData, playCount: parseInt(e.target.value)})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="youtube" className="text-right">YouTube</Label>
                  <Input id="youtube" value={formData.youtubeLink || ''} onChange={e => setFormData({...formData, youtubeLink: e.target.value})} className="col-span-3" placeholder="https://youtube.com/..." />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="file" className="text-right">Audio/Track</Label>
                  <div className="col-span-3 space-y-2">
                    <Input id="file" type="file" onChange={handleFileUpload} disabled={uploading} />
                    {uploading && <p className="text-xs text-primary animate-pulse">Wird hochgeladen...</p>}
                    {formData.fileUrl && <p className="text-xs text-green-600 truncate">Datei bereit: {formData.fileUrl}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="notes" className="text-right pt-2">Notizen</Label>
                  <div className="col-span-3 space-y-1">
                    <textarea 
                      id="notes" 
                      value={formData.notes || ''} 
                      onChange={e => setFormData({...formData, notes: e.target.value})} 
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                      maxLength={1000}
                    />
                    {formData.notes && (
                      <div className="text-[10px] text-right text-muted-foreground">
                        {formData.notes.length} / 1000 Zeichen
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAddOpen(false);
                setEditingSong(null);
                setFormData({ title: '', artist: '', status: 3, notes: '', youtubeLink: '', fileUrl: '', isArchived: false, lastPlayed: '', playCount: 0 });
              }}>Abbrechen</Button>
              <Button onClick={handleSave}>Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Suchen nach Titel oder Interpret..." 
                className="pl-10"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant={showArchived ? "secondary" : "ghost"} 
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                className="gap-2"
              >
                <Archive className="h-4 w-4" />
                {showArchived ? "Archivierte anzeigen" : "Aktive anzeigen"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="w-[250px] cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('title')}>
                    <div className="flex items-center">
                      Titel / Interpret
                      <SortIcon field="title" />
                    </div>
                  </TableHead>
                  <TableHead className="text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('status')}>
                    <div className="flex items-center justify-center">
                      Status
                      <SortIcon field="status" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('lastPlayed')}>
                    <div className="flex items-center">
                      Zuletzt gespielt
                      <SortIcon field="lastPlayed" />
                    </div>
                  </TableHead>
                  <TableHead className="text-center cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('playCount')}>
                    <div className="flex items-center justify-center">
                      Gespielt
                      <SortIcon field="playCount" />
                    </div>
                  </TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead>Notizen</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSongs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                      Keine Songs gefunden.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSongs.map((song) => (
                    <TableRow key={song.id}>
                      <TableCell>
                        <div className="font-bold">{song.title}</div>
                        <div className="text-xs text-gray-500">{song.artist}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`
                          ${song.status <= 2 ? 'bg-green-50 text-green-700 border-green-200' : 
                            song.status >= 5 ? 'bg-red-50 text-red-700 border-red-200' : 
                            'bg-yellow-50 text-yellow-700 border-yellow-200'}
                        `}>
                          Note {song.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs flex items-center gap-1 text-gray-600">
                          <CalendarIcon className="h-3 w-3" />
                          {song.lastPlayed ? format(parseISO(song.lastPlayed), 'dd.MM.yyyy') : '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-mono font-bold">{song.playCount || 0}x</span>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-6 w-6 rounded-full" 
                            onClick={() => incrementPlayCount(song)}
                            title="Zähler erhöhen & Datum auf heute setzen"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {song.youtubeLink && (
                            <a href={song.youtubeLink} target="_blank" rel="noreferrer" className="text-red-600 hover:text-red-700">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {song.fileUrl && (
                            <a href={song.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700">
                              <FileAudio className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-gray-600">
                        {song.notes || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setEditingSong(song);
                            setFormData(song);
                            setIsAddOpen(true);
                          }}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleArchive(song)}>
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => {
                              setSongToDelete(song);
                              setIsDeleteOpen(true);
                            }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Song löschen</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            Möchtest du <strong>{songToDelete?.title}</strong> wirklich löschen?
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDelete}>Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
