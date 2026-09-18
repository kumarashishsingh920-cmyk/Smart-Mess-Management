import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const memory = {
  users: [],
  menus: [],
  attendances: [],
  chats: []
};

export async function connectDB() {
  if (!process.env.MONGODB_URI) {
    console.log("MONGODB_URI not set: using in-memory demo store.");
    await seedMemory();
    return;
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected.");
  } catch (err) {
    console.warn("MongoDB connection failed; using in-memory demo store:", err.message);
    await seedMemory();
  }
}

const userSchema = new mongoose.Schema({
  name: String, email: { type: String, unique: true }, passwordHash: String,
  role: { type: String, enum: ["student", "admin"], default: "student" },
  rollNumber: String, hostelBlock: String, notifications: { type: Boolean, default: true }
}, { timestamps: true });

const menuSchema = new mongoose.Schema({
  date: { type: String, index: true }, breakfast: String, lunch: String, dinner: String
}, { timestamps: true });

const attendanceSchema = new mongoose.Schema({
  date: { type: String, index: true }, studentId: mongoose.Schema.Types.ObjectId,
  eating: Boolean, mealType: { type: String, enum: ["veg", "non-veg"] },
  submittedAt: Date, checkedInAt: Date
}, { timestamps: true });

const chatSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId, question: String, answer: String
}, { timestamps: true });

export const User = mongoose.model("User", userSchema);
export const Menu = mongoose.model("Menu", menuSchema);
export const Attendance = mongoose.model("Attendance", attendanceSchema);
export const Chat = mongoose.model("Chat", chatSchema);

export function isMongo() {
  return Boolean(mongoose.connection.readyState === 1);
}

async function seedMemory() {
  if (memory.users.length) return;
  const adminHash = await bcrypt.hash("Admin@123", 10);
  const studentHash = await bcrypt.hash("Student@123", 10);
  memory.users.push(
    { _id: "admin-1", name: "Mess Admin", email: "admin@smartmess.local", passwordHash: adminHash, role: "admin", rollNumber: "", hostelBlock: "Admin" },
    { _id: "student-1", name: "Demo Student", email: "student@smartmess.local", passwordHash: studentHash, role: "student", rollNumber: "SRM001", hostelBlock: "A-Block" }
  );
  const d = new Date().toISOString().slice(0,10);
  memory.menus.push({ _id: "menu-1", date: d, breakfast: "Idli, Sambar, Chutney", lunch: "Rice, Dal, Paneer", dinner: "Chapati, Veg Curry, Curd" });
}
