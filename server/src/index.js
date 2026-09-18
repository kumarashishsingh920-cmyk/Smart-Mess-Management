import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import crypto from "node:crypto";
import * as XLSX from "xlsx";
import { connectDB, User, Menu, Attendance, Chat, memory, isMongo } from "./db.js";
import { auth, adminOnly, signToken } from "./auth.js";
import { statsForDate, predictDemand, last30Days, aiAnswer, aiInsight, sendEmail } from "./services.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL?.split(",") || "*", credentials: true }));
app.use(express.json());

const today = () => new Date().toISOString().slice(0,10);

async function findUser(id) {
  return isMongo() ? User.findById(id) : memory.users.find(u => String(u._id) === String(id));
}
async function findMenu(date) {
  return isMongo() ? Menu.findOne({ date }) : memory.menus.find(m => m.date === date);
}

app.get("/api/health", (_,res)=>res.json({ok:true, date:today()}));

app.post("/api/auth/login", async (req,res)=>{
  const { email, password, role } = req.body;
  const user = isMongo() ? await User.findOne({email, role}) : memory.users.find(u=>u.email===email && u.role===role);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({message:"Invalid credentials"});
  res.json({ token: signToken(user), user: { id:String(user._id), name:user.name, email:user.email, role:user.role, rollNumber:user.rollNumber, hostelBlock:user.hostelBlock, notifications:user.notifications ?? true }});
});

app.get("/api/me", auth, async (req,res)=>{
  const u = await findUser(req.user.id);
  if (!u) return res.status(404).json({message:"User not found"});
  res.json({id:String(u._id),name:u.name,email:u.email,role:u.role,rollNumber:u.rollNumber,hostelBlock:u.hostelBlock,notifications:u.notifications ?? true});
});

app.put("/api/me", auth, async (req,res)=>{
  const patch = { name:req.body.name, rollNumber:req.body.rollNumber, hostelBlock:req.body.hostelBlock, notifications:req.body.notifications };
  if (isMongo()) await User.findByIdAndUpdate(req.user.id, patch);
  else Object.assign(memory.users.find(u=>String(u._id)===String(req.user.id)), patch);
  res.json({message:"Profile updated"});
});

app.get("/api/menu/today", auth, async (_,res)=>{
  res.json(await findMenu(today()) || {date:today(), breakfast:"Not set", lunch:"Not set", dinner:"Not set"});
});

app.put("/api/admin/menu", auth, adminOnly, async (req,res)=>{
  const data = {date:req.body.date || today(), breakfast:req.body.breakfast||"", lunch:req.body.lunch||"", dinner:req.body.dinner||""};
  if (isMongo()) await Menu.findOneAndUpdate({date:data.date}, data, {upsert:true,new:true});
  else {
    const old = memory.menus.find(m=>m.date===data.date);
    old ? Object.assign(old,data) : memory.menus.push({_id:crypto.randomUUID(),...data});
  }
  res.json({message:"Menu saved"});
});

app.post("/api/attendance", auth, async (req,res)=>{
  const { eating, mealType } = req.body;
  if (typeof eating !== "boolean" || (eating && !["veg","non-veg"].includes(mealType))) return res.status(400).json({message:"Invalid meal preference"});
  const data = {date:today(), studentId:req.user.id, eating, mealType:eating?mealType:null, submittedAt:new Date()};
  if (isMongo()) await Attendance.findOneAndUpdate({date:data.date,studentId:req.user.id},data,{upsert:true,new:true});
  else {
    const old=memory.attendances.find(a=>a.date===data.date && String(a.studentId)===String(req.user.id));
    old ? Object.assign(old,data) : memory.attendances.push({_id:crypto.randomUUID(),...data});
  }
  res.json({message:"Meal preference submitted successfully"});
});

app.get("/api/attendance/today", auth, async (req,res)=>{
  const a = isMongo() ? await Attendance.findOne({date:today(),studentId:req.user.id}).lean() : memory.attendances.find(x=>x.date===today() && String(x.studentId)===String(req.user.id));
  res.json(a || null);
});

app.post("/api/checkin", auth, async (req,res)=>{
  const a = isMongo() ? await Attendance.findOne({date:today(),studentId:req.user.id}) : memory.attendances.find(x=>x.date===today() && String(x.studentId)===String(req.user.id));
  if (!a) return res.status(400).json({message:"Submit your meal preference first"});
  if (isMongo()) await Attendance.findByIdAndUpdate(a._id,{checkedInAt:new Date()});
  else a.checkedInAt = new Date();
  res.json({message:"QR check-in recorded"});
});

app.get("/api/checkin/qr", auth, async (req,res)=>{
  const token = await QRCode.toDataURL(JSON.stringify({studentId:req.user.id,date:today(),purpose:"mess-checkin"}));
  res.json({qr:token});
});

app.get("/api/admin/stats", auth, adminOnly, async (_,res)=>res.json(await statsForDate(today())));
app.get("/api/admin/history", auth, adminOnly, async (_,res)=>res.json(await last30Days()));
app.get("/api/admin/prediction", auth, adminOnly, async (_,res)=>res.json(await predictDemand()));

app.get("/api/admin/students", auth, adminOnly, async (req,res)=>{
  const students = isMongo() ? await User.find({role:"student"}).lean() : memory.users.filter(u=>u.role==="student");
  const records = isMongo() ? await Attendance.find({date:today()}).lean() : memory.attendances.filter(a=>a.date===today());
  const map = new Map(records.map(r=>[String(r.studentId),r]));
  res.json(students.map(s=>({...s,passwordHash:undefined,attendance:map.get(String(s._id))||null})));
});

app.get("/api/admin/report.xlsx", auth, adminOnly, async (_,res)=>{
  const students = isMongo() ? await User.find({role:"student"}).lean() : memory.users.filter(u=>u.role==="student");
  const records = isMongo() ? await Attendance.find({date:today()}).lean() : memory.attendances.filter(a=>a.date===today());
  const map = new Map(records.map(r=>[String(r.studentId),r]));
  const rows = students.map(s=>({Name:s.name,RollNumber:s.rollNumber,Hostel:s.hostelBlock,Status:map.get(String(s._id))?.eating?"Eating":"Absent",Type:map.get(String(s._id))?.mealType||"-",CheckedIn:map.get(String(s._id))?.checkedInAt?"Yes":"No"}));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"Daily Report");
  const out=XLSX.write(wb,{type:"buffer",bookType:"xlsx"});
  res.setHeader("Content-Disposition",`attachment; filename=smart-mess-${today()}.xlsx`);
  res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(out);
});

app.get("/api/admin/ai-insight", auth, adminOnly, async (_,res)=>{
  const context={history:await last30Days(),prediction:await predictDemand(),today:await statsForDate(today())};
  res.json({insight:await aiInsight(context),prediction:context.prediction});
});

app.post("/api/admin/ai-chat", auth, adminOnly, async (req,res)=>{
  const context={history:await last30Days(),prediction:await predictDemand(),today:await statsForDate(today())};
  const answer=await aiAnswer(req.body.question||"",context);
  if(isMongo()) await Chat.create({userId:req.user.id,question:req.body.question,answer});
  else memory.chats.push({_id:crypto.randomUUID(),userId:req.user.id,question:req.body.question,answer,createdAt:new Date()});
  res.json({answer});
});

app.get("/api/admin/ai-history", auth, adminOnly, async (req,res)=>{
  const rows=isMongo()?await Chat.find({userId:req.user.id}).sort({createdAt:-1}).limit(50).lean():memory.chats.filter(c=>String(c.userId)===String(req.user.id)).slice(-50).reverse();
  res.json(rows);
});

app.post("/api/admin/send-reminder", auth, adminOnly, async (_,res)=>{
  const students=await (isMongo()?User.find({role:"student",notifications:true}).lean():memory.users.filter(u=>u.role==="student"&&u.notifications!==false));
  let sent=0;
  for(const s of students){ if(await sendEmail(s.email,"Smart Mess reminder","Please submit today's meal preference before the deadline.")) sent++; }
  res.json({message:`Reminder processed for ${students.length} students`,sent});
});

app.get("/api/admin/reports/summary", auth, adminOnly, async (_,res)=>{
  const history=await last30Days();
  const totalEating=history.reduce((s,r)=>s+r.eating,0);
  const totalVeg=history.reduce((s,r)=>s+r.veg,0);
  const totalNonVeg=history.reduce((s,r)=>s+r.nonVeg,0);
  res.json({history,totalEating,totalVeg,totalNonVeg,estimatedWastageRisk:Math.round((totalEating?Math.max(0,totalEating*0.08):0))});
});

app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({message:"Server error"});});

await connectDB();
app.listen(process.env.PORT||5000,()=>console.log(`API running on ${process.env.PORT||5000}`));
