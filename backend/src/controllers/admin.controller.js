import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import cloudinary, { isCloudinaryConfigured } from "../lib/cloudinary.js";
import { parseFile, parseBuffer } from "music-metadata";

const assertCloudinary = () => {
  if (!isCloudinaryConfigured) {
    const error = new Error(
      "Cloudinary is not configured. Admin uploads require CLOUDINARY_* env vars.",
    );
    error.status = 503;
    throw error;
  }
};

const uploadToCloudinary = async (file, options = {}) => {
  assertCloudinary();
  try {
    let uploadSource;
    let filePath;

    // Determine upload source
    if (file.tempFilePath) {
      uploadSource = file.tempFilePath;
      filePath = file.tempFilePath;
    } else if (file.data || Buffer.isBuffer(file)) {
      uploadSource = file.data || file;
      filePath = null;
    } else {
      throw new Error("Invalid file format");
    }

    // Upload the main file FIRST
    console.log("Uploading main file...");
    const result = await cloudinary.uploader.upload(uploadSource, {
      resource_type: options.resource_type || "auto",
      folder: options.folder || "uploads",
      public_id: options.public_id,
      timeout: 120000,
      chunk_size: 6000000,
      ...options.uploadOptions,
    });
    console.log(" Main file uploaded successfully");

    // NOW parse metadata after upload succeeds
    console.log("Parsing metadata...");
    let metadata;
    if (filePath) {
      metadata = await parseFile(filePath);
    } else {
      metadata = await parseBuffer(uploadSource, {
        mimeType: file.mimetype || options.mimeType,
      });
    }
    console.log(" Metadata parsed");

    // Upload cover art if available
    let coverUrl = null;
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      console.log(`Found ${metadata.common.picture.length} embedded image(s)`);
      const picture = metadata.common.picture[0];
      console.log("Cover art details:", {
        format: picture.format,
        size: picture.data?.length,
        description: picture.description,
        type: picture.type,
      });

      try {
        // Validate picture data
        if (!picture.data || picture.data.length === 0) {
          throw new Error("Picture data is empty");
        }

        if (!picture.format) {
          throw new Error("Picture format is missing");
        }

        console.log("Uploading cover art...");
        const coverResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { ...options },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            },
          );

          uploadStream.end(picture.data); // Send buffer directly
        });
        coverUrl = coverResult.secure_url;
        console.log("Cover art uploaded successfully");
      } catch (coverError) {
        console.error(" Failed to upload cover art:", {
          message: coverError.message,
          name: coverError.name,
          code: coverError.code,
          http_code: coverError.error?.http_code,
          error_message: coverError.error?.message,
          stack: coverError.stack?.split("\n")[0], // First line of stack trace
        });
      }
    } else {
      console.log("No embedded cover art found in file");
    }

    return {
      fileUrl: result.secure_url,
      publicId: result.public_id,
      coverUrl: coverUrl,
      metadata: {
        title: metadata.common?.title,
        artist: metadata.common?.artist,
        album: metadata.common?.album,
        year: metadata.common?.year,
        genre: metadata.common?.genre,
        duration: metadata.format?.duration,
      },
    };
  } catch (error) {
    const errorInfo = {
      message: error.message,
      name: error.name,
      code: error.code,
      http_code: error.error?.http_code,
      error_message: error.error?.message,
    };

    console.error("Cloudinary upload error:", errorInfo);

    if (error.error && error.error.http_code === 499) {
      throw new Error(
        "Upload timeout - file may be too large or connection is slow",
      );
    }

    throw new Error("Error when uploading to cloudinary: " + error.message);
  }
};

const DEFAULT_COVER_URL =
  "https://res.cloudinary.com/dotodoxd8/image/upload/v1769277240/default-cover_dlpbki.png";

export const createSong = async (req, res, next) => {
  try {
    if (!req.files || !req.files.audioFile) {
      return res.status(400).json({ message: "Please upload an audio file" });
    }

    const audioFile = req.files.audioFile;
    const imageFile = req.files.imageFile;

    console.log(
      "Audio file size:",
      (audioFile.size / 1024 / 1024).toFixed(2),
      "MB",
    );
    if (imageFile) {
      console.log(
        "Image file size:",
        (imageFile.size / 1024 / 1024).toFixed(2),
        "MB",
      );
    }

    // Upload audio file and extract metadata
    const audioResult = await uploadToCloudinary(audioFile, {
      folder: "songs",
      resource_type: "auto",
    });

    // Prepare metadata with fallbacks
    const title =
      req.body.title ||
      audioResult.metadata?.title ||
      audioFile.name.replace(/\.[^/.]+$/, "") ||
      "Untitled Song";

    const artist =
      req.body.artist ||
      audioResult.metadata?.artist?.[0] ||
      audioResult.metadata?.artist ||
      "Unknown Artist";

    const album = req.body.album || audioResult.metadata?.album || null;

    const year = req.body.year || audioResult.metadata?.year || null;

    const genre =
      req.body.genre ||
      audioResult.metadata?.genre?.[0] ||
      audioResult.metadata?.genre ||
      null;

    const duration = audioResult.metadata?.duration || 0;

    // Handle image upload with fallback chain
    let imgUrl;
    if (imageFile) {
      // Priority 1: User provided an image
      const imageResult = await uploadToCloudinary(imageFile, {
        folder: "album_covers",
        resource_type: "image",
      });
      imgUrl = imageResult.fileUrl || imageResult;
    } else if (audioResult.coverUrl) {
      // Priority 2: Use extracted cover art from audio file
      imgUrl = audioResult.coverUrl;
    } else {
      // Priority 3: Use default placeholder
      imgUrl = DEFAULT_COVER_URL;
    }

    // Create song document
    const song = new Song({
      title,
      artist,
      album,
      year,
      genre,
      audioUrl: audioResult.fileUrl || audioResult,
      imgUrl,
      duration,
      albumId: req.body.albumId || null,
    });

    await song.save();

    // Add song to album if albumId is provided
    if (req.body.albumId) {
      await Album.findByIdAndUpdate(req.body.albumId, {
        $push: { songs: song._id },
      });
    }

    res.status(201).json({
      success: true,
      song,
      message: "Song created successfully",
    });
  } catch (error) {
    console.error("Error in createSong:", error);
    next(error);
  }
};

export const deleteSong = async (req, res, next) => {
  try {
    const { id } = req.params;
    const song = await Song.findById(id);
    if (song.albumId) {
      await Album.findByIdAndUpdate(song.albumId, {
        $pull: { songs: song._id },
      });
    }

    await Song.findByIdAndDelete(id);
    res.status(200).json({ message: "Song deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const createAlbum = async (req, res, next) => {
  try {
    const { title, artist } = req.body;
    const releaseDate =
      req.body.releaseDate || req.body.releaseYear || new Date().getFullYear();
    const imageFile = req.files?.imageFile;

    if (!imageFile) {
      return res.status(400).json({ message: "Please upload an album image" });
    }

    const imageResult = await uploadToCloudinary(imageFile, {
      folder: "album_covers",
      resource_type: "image",
    });

    const album = new Album({
      title,
      artist,
      imageUrl: imageResult.fileUrl || imageResult,
      releaseDate: Number(releaseDate),
    });

    await album.save();

    res.status(201).json(album);
  } catch (error) {
    next(error);
  }
};

export const deleteAlbum = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Song.deleteMany({ albumId: id });
    await Album.findByIdAndDelete(id);
    res.status(200).json({ message: "Album deleted successfully" });
  } catch (error) {
    console.log("error in deleteAlbum");
    next(error);
  }
};

export const checkAdmin = async (req, res, next) => {
  res.status(200).json({ admin: true });
};
