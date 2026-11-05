import { Router } from "express";
import * as musicController from "../controllers/music.controller.js";

const router = Router();

// Discovery
router.get("/home", musicController.getHome);
router.get("/personalized", musicController.getPersonalized);
router.get("/charts", musicController.getCharts);
router.get("/trending", musicController.getTrending);
router.get("/genres", musicController.getGenres);
router.get("/genres/:genre", musicController.getGenre);

// Search
router.get("/search", musicController.searchAll);
router.get("/search/tracks", musicController.searchTracks);
router.get("/search/albums", musicController.searchAlbums);
router.get("/search/artists", musicController.searchArtists);
router.get("/search/playlists", musicController.searchPlaylists);
router.get("/search/podcasts", musicController.searchPodcasts);
router.get("/autocomplete", musicController.autocomplete);
router.get("/match", musicController.matchTrack);

// Details
router.get("/tracks/:provider/:id", musicController.getTrack);
router.get("/albums/:provider/:id", musicController.getAlbum);
router.get("/artists/:provider/:id", musicController.getArtist);
router.get("/playlists/:provider/:id", musicController.getPlaylist);
router.get("/podcasts/:id", musicController.getPodcast);
router.get("/related/:provider/:id", musicController.getRelated);
router.get("/resolve", musicController.resolveLinks);

// Media
router.get("/stream", musicController.getStream);
router.post("/upgrade-full", musicController.upgradeFull);
router.get("/preview", musicController.getPreview);
router.get("/quality", musicController.getQuality);
router.get("/artwork", musicController.getArtwork);
router.get("/lyrics", musicController.getLyrics);

// Radio
router.get("/radio", musicController.searchRadio);
router.get("/radio/top", musicController.topRadio);
router.get("/radio/tags", musicController.radioTags);
router.get("/radio/countries", musicController.radioCountries);
router.get("/radio/:uuid/stream", musicController.radioStream);

export default router;
