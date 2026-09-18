import jwt from "jsonwebtoken";

export function signToken(user) {
  return jwt.sign({ id: String(user._id), role: user.role }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });
}

export function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Authentication required" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
}
