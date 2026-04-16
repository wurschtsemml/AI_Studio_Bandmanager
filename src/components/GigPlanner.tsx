import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserProfile, Gig, GigStatus } from '../types';
import { MapPin, Plus, Trash2, Archive, Phone, Mail, User, Calendar, Search, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  profile: UserProfile | null;
}

export default function GigPlanner({ profile }: Props) {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingGig, setEditingGig] = useState<Gig | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<Gig>>({
    name: '',
    organizer: '',
    phone: '',
    email: '',
    status: 'In Anfrage',
    date: '',
    notes: '',
    isArchived: false
  });

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [gigToDelete, setGigToDelete] = useState<Gig | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'gigs'));
    const unsub = onSnapshot(q, (snapshot) => {
      setGigs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Gig)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'gigs'));
    return unsub;
  }, []);

  const handleSave = async () => {
    if (!formData.name || !formData.status) {
      toast.error('Name und Status sind Pflichtfelder');
      return;
    }

    try {
      if (editingGig) {
        await updateDoc(doc(db, 'gigs', editingGig.id!), formData);
        toast.success('Gig aktualisiert');
      } else {
        await addDoc(collection(db, 'gigs'), { ...formData, isArchived: false });
        toast.success('Gig hinzugefügt');
      }
      setIsAddOpen(false);
      setEditingGig(null);
      setFormData({ name: '', organizer: '', phone: '', email: '', status: 'In Anfrage', date: '', notes: '', isArchived: false });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'gigs');
    }
  };

  const handleDelete = async () => {
    if (!gigToDelete?.id) return;
    
    const toastId = toast.loading('Gig wird gelöscht...');
    try {
      await deleteDoc(doc(db, 'gigs', gigToDelete.id));
      toast.success('Gig gelöscht', { id: toastId });
      setIsDeleteOpen(false);
      setGigToDelete(null);
    } catch (error) {
      console.error('Delete gig error:', error);
      toast.error('Fehler beim Löschen', { id: toastId });
    }
  };

  const toggleArchive = async (gig: Gig) => {
    try {
      await updateDoc(doc(db, 'gigs', gig.id!), { isArchived: !gig.isArchived });
      toast.success(gig.isArchived ? 'Gig reaktiviert' : 'Gig archiviert');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `gigs/${gig.id}`);
    }
  };

  const filteredGigs = gigs.filter(g => {
    const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase()) || 
                          (g.organizer?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesArchive = showArchived ? g.isArchived : !g.isArchived;
    return matchesSearch && matchesArchive;
  });

  const getStatusBadge = (status: GigStatus) => {
    switch (status) {
      case 'Bestätigt': return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Bestätigt</Badge>;
      case 'Abgelehnt': return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Abgelehnt</Badge>;
      case 'Beworben': return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">Beworben</Badge>;
      default: return <Badge variant="outline" className="bg-gray-50 text-gray-600">In Anfrage</Badge>;
    }
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gig-Planer</h1>
          <p className="text-gray-500">Übersicht aller potenziellen und festen Auftritte.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Gig hinzufügen
            </Button>
          } />
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingGig ? 'Gig bearbeiten' : 'Neuen Gig planen'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Veranstaltung</Label>
                  <Input id="name" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="organizer" className="text-right">Veranstalter</Label>
                  <Input id="organizer" value={formData.organizer || ''} onChange={e => setFormData({...formData, organizer: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="date" className="text-right">Datum</Label>
                  <Input id="date" type="date" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="status" className="text-right">Status</Label>
                  <div className="col-span-3">
                    <Select value={formData.status} onValueChange={(val: GigStatus) => setFormData({...formData, status: val})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Status wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="In Anfrage">In Anfrage</SelectItem>
                        <SelectItem value="Beworben">Beworben</SelectItem>
                        <SelectItem value="Bestätigt">Bestätigt</SelectItem>
                        <SelectItem value="Abgelehnt">Abgelehnt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">Telefon</Label>
                  <Input id="phone" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">E-Mail</Label>
                  <Input id="email" type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="notes" className="text-right">Notizen</Label>
                  <Input id="notes" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} className="col-span-3" placeholder="Zusätzliche Infos..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsAddOpen(false);
                  setEditingGig(null);
                  setFormData({ name: '', organizer: '', phone: '', email: '', status: 'In Anfrage', date: '', notes: '', isArchived: false });
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
                placeholder="Suchen nach Veranstaltung..." 
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
                  <TableHead className="w-[200px]">Veranstaltung</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Notizen</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGigs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                      Keine Gigs gefunden.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGigs.map((gig) => (
                    <TableRow key={gig.id}>
                      <TableCell>
                        <div className="font-bold">{gig.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <User className="h-3 w-3" /> {gig.organizer || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          {gig.date ? new Date(gig.date).toLocaleDateString('de-DE') : 'Offen'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(gig.status)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {gig.phone && (
                            <div className="text-xs flex items-center gap-1 text-gray-600">
                              <Phone className="h-3 w-3" /> {gig.phone}
                            </div>
                          )}
                          {gig.email && (
                            <div className="text-xs flex items-center gap-1 text-gray-600">
                              <Mail className="h-3 w-3" /> {gig.email}
                            </div>
                          )}
                          {!gig.phone && !gig.email && <span className="text-xs text-gray-400">-</span>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs text-gray-600">
                        {gig.notes || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setEditingGig(gig);
                            setFormData(gig);
                            setIsAddOpen(true);
                          }}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleArchive(gig)}>
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => {
                              setGigToDelete(gig);
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
            <DialogTitle>Gig löschen</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            Möchtest du <strong>{gigToDelete?.name}</strong> wirklich löschen?
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
