import { clerkClient } from "@clerk/express";

export const getAuthUserId = (req) => {
  try {
    const auth = typeof req.auth === "function" ? req.auth() : req.auth;
    return auth?.userId || null;
  } catch {
    return null;
  }
};

export const protectRoute = async (req, res, next) => {
  if (!getAuthUserId(req)) {
    return res
      .status(401)
      .json({ message: "Unauthorized - you must be logged in" });
  }
  next();
};

export const requireAdmin = async (req, res, next) => {
  try {
    const currentUser = await clerkClient.users.getUser(getAuthUserId(req));
    const isAdmin =
      process.env.ADMIN_EMAIL === currentUser.primaryEmailAddress?.emailAddress;

    if (!isAdmin) {
      return res
        .status(403)
        .json({ message: "Unauthorized - you must be an admin" });
    }

    next();
  } catch (error) {
    next(error);
  }
};
