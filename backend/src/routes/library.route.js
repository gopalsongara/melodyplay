import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import * as libraryController from "../controllers/library.controller.js";

const router = Router();

router.use(protectRoute);

router.get("/favorites", libraryController.listFavorites);
router.post("/favorites", libraryController.addFavorite);
router.delete("/favorites/:trackId", libraryController.removeFavorite);

router.get("/history", libraryController.listHistory);
router.post("/history", libraryController.addHistory);
router.delete("/history", libraryController.clearHistory);

router.get("/playlists", libraryController.listUserPlaylists);
router.post("/playlists", libraryController.createUserPlaylist);
router.get("/playlists/:id", libraryController.getUserPlaylist);
router.post("/playlists/:id/tracks", libraryController.addTrackToPlaylist);
router.delete(
  "/playlists/:id/tracks/:trackId",
  libraryController.removeTrackFromPlaylist,
);
router.delete("/playlists/:id", libraryController.deleteUserPlaylist);

export default router;
