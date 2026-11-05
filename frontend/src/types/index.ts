export interface Song {
  _id: string;
  id?: string;
  title: string;
  artist: string;
  albumId: string | null;
  imgUrl: string;
  audioUrl: string;
  duration: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlayableTrack {
  _id: string;
  id?: string;
  provider?: string;
  providerId?: string;
  type?: string;
  title: string;
  artist: string;
  album?: string | null;
  albumId?: string | null;
  artistId?: string | null;
  imgUrl: string;
  audioUrl: string;
  duration: number;
  isPreview?: boolean;
  previewDuration?: number | null;
  mimeType?: string | null;
  playable?: boolean;
  needsStreamResolve?: boolean;
  isLive?: boolean;
  explicit?: boolean;
  externalUrl?: string | null;
  expiresAt?: string | null;
  source?: "local" | "external";
  createdAt?: string;
  updatedAt?: string;
}

export interface Album {
  _id?: string;
  id?: string;
  provider?: string;
  providerId?: string;
  title: string;
  artist: string;
  imageUrl?: string;
  imgUrl?: string;
  releaseDate?: number | string | null;
  songs?: Song[];
  tracks?: PlayableTrack[];
  trackCount?: number | null;
  externalUrl?: string | null;
}

export interface Artist {
  id: string;
  provider: string;
  providerId: string;
  title?: string;
  name: string;
  imgUrl: string;
  fans?: number | null;
  albumCount?: number | null;
  externalUrl?: string | null;
}

export interface ExternalPlaylist {
  id: string;
  provider: string;
  providerId: string;
  title: string;
  artist: string;
  imgUrl: string;
  trackCount?: number | null;
  externalUrl?: string | null;
}

export interface Podcast {
  id: string;
  provider: string;
  providerId: string;
  title: string;
  artist: string;
  description?: string | null;
  imgUrl: string;
  externalUrl?: string | null;
}

export interface RadioStation extends PlayableTrack {
  isLive?: boolean;
  country?: string | null;
  tags?: string | null;
}

export interface Stats {
  songsCount: number;
  albumsCount: number;
  usersCount: number;
  uniqueArtists: number;
}

export interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  _id: string;
  clerkId: string;
  fullName: string;
  imgUrl: string;
}

export interface SearchResult {
  songs?: Song[];
  albums?: Album[];
  tracks?: PlayableTrack[];
  artists?: Artist[];
  playlists?: ExternalPlaylist[];
  podcasts?: Podcast[];
}

export type SearchFilter = "songs" | "albums" | "tracks" | "artists" | "playlists" | "podcasts";

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

export interface UserPlaylist {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  imgUrl?: string;
  tracks: PlayableTrack[];
  createdAt?: string;
  updatedAt?: string;
}

export type RepeatMode = "off" | "all" | "one";
