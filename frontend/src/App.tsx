import { Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import HomePage from "./pages/home/HomePage";
import AuthCallBackPage from "./pages/auth-callback/AuthCallBackPage";
import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import MainLayout from "./layout/MainLayout";
import ChatPage from "./pages/chat/ChatPage";
import AlbumPage from "./pages/album/AlbumPage";
import AdminPage from "./pages/admin/AdminPage";
import SearchPage from "./pages/search/SearchPage";
import ExternalAlbumPage from "./pages/ext/ExternalAlbumPage";
import ExternalArtistPage from "./pages/ext/ExternalArtistPage";
import ExternalPlaylistPage from "./pages/ext/ExternalPlaylistPage";
import RadioPage from "./pages/radio/RadioPage";
import ChartsPage from "./pages/charts/ChartsPage";
import GenrePage from "./pages/genres/GenrePage";
import PodcastsPage from "./pages/podcasts/PodcastsPage";
import PodcastDetailPage from "./pages/podcasts/PodcastDetailPage";
import LyricsPage from "./pages/lyrics/LyricsPage";
import QueuePage from "./pages/queue/QueuePage";
import FavoritesPage from "./pages/library/FavoritesPage";
import UserPlaylistsPage from "./pages/library/UserPlaylistsPage";
import UserPlaylistDetailPage from "./pages/library/UserPlaylistDetailPage";
import ProfilePage from "./pages/profile/ProfilePage";
import ExplorePage from "./pages/explore/ExplorePage";
import NotFoundPage from "./pages/404/NotFoundPage";

function App() {
  return (
    <>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/charts" element={<ChartsPage />} />
          <Route path="/radio" element={<RadioPage />} />
          <Route path="/podcasts" element={<PodcastsPage />} />
          <Route path="/podcasts/:id" element={<PodcastDetailPage />} />
          <Route path="/genres/:genre" element={<GenrePage />} />
          <Route path="/lyrics" element={<LyricsPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/library/playlists" element={<UserPlaylistsPage />} />
          <Route
            path="/library/playlists/:id"
            element={<UserPlaylistDetailPage />}
          />
          <Route
            path="/ext/albums/:provider/:id"
            element={<ExternalAlbumPage />}
          />
          <Route
            path="/ext/artists/:provider/:id"
            element={<ExternalArtistPage />}
          />
          <Route
            path="/ext/playlists/:provider/:id"
            element={<ExternalPlaylistPage />}
          />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/albums/:albumId" element={<AlbumPage />} />
        </Route>
        <Route
          path="/sso-callback"
          element={
            <AuthenticateWithRedirectCallback
              signInForceRedirectUrl={"/auth-callback"}
            />
          }
        />
        <Route path="/auth-callback" element={<AuthCallBackPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster position="top-center" reverseOrder={false} />
    </>
  );
}

export default App;
