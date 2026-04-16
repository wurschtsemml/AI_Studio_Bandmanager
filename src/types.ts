export type UserRole = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  instrument?: string;
}

export type AvailabilityStatus = 'neutral' | 'available' | 'unavailable';

export interface Availability {
  id?: string;
  userId: string;
  date: string; // YYYY-MM-DD
  status: AvailabilityStatus;
}

export interface Song {
  id?: string;
  title: string;
  artist: string;
  status: number; // 1-6
  notes?: string;
  youtubeLink?: string;
  fileUrl?: string;
  isArchived?: boolean;
  lastPlayed?: string; // YYYY-MM-DD
  playCount?: number;
}

export interface BandSettings {
  logoUrl?: string;
  bandName?: string;
}

export type GigStatus = 'In Anfrage' | 'Beworben' | 'Bestätigt' | 'Abgelehnt';

export interface Gig {
  id?: string;
  name: string;
  organizer?: string;
  phone?: string;
  email?: string;
  status: GigStatus;
  date?: string;
  notes?: string;
  isArchived?: boolean;
}
