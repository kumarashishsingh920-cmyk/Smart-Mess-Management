import nodemailer from "nodemailer";
import OpenAI from "openai";
import { Attendance, User, memory, isMongo } from "./db.js";

export async function listUsers() {
  return isMongo() ? User.find({ role: "student" }).lean() : memory.users.filter(u => u.role === "student");
}

export async function statsForDate(date) {
  const students = await listUsers();
  const records = isMongo() ? await Attendance.find({ date }).lean() : memory.attendances.filter(a => a.date === date);
  const submitted = records.filter(r => r.eating);
  const veg = submitted.filter(r => r.mealType === "veg").length;
  const nonVeg = submitted.filter(r => r.mealType === "non-veg").length;
  return {
    totalStudents: students.length,
    eating: submitted.length,
    veg,
    nonVeg,
    absent: Math.max(0, students.length - submitted.length),
    percentage: students.length ? Math.round(submitted.length / students.length * 100) : 0
  };
}

export async function last30Days() {
  const rows = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0,10);
    const records = isMongo() ? await Attendance.find({ date: d }).lean() : memory.attendances.filter(a => a.date === d);
    rows.push({
      date: d,
      veg: records.filter(r => r.eating && r.mealType === "veg").length,
      nonVeg: records.filter(r => r.eating && r.mealType === "non-veg").length,
      eating: records.filter(r => r.eating).length
    });
  }
  return rows;
}

export async function predictDemand() {
  const rows = await last30Days();
  const nonZero = rows.filter(r => r.eating > 0);
  const base = nonZero.length ? nonZero : rows;
  const avgVeg = base.reduce((s,r)=>s+r.veg,0)/Math.max(base.length,1);
  const avgNonVeg = base.reduce((s,r)=>s+r.nonVeg,0)/Math.max(base.length,1);
  return {
    veg: Math.max(0, Math.round(avgVeg * 1.05)),
    nonVeg: Math.max(0, Math.round(avgNonVeg * 1.05)),
    confidence: nonZero.length >= 14 ? "High" : nonZero.length >= 7 ? "Medium" : "Low",
    history: rows
  };
}

export async function sendEmail(to, subject, text) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return false;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
  return true;
}

export async function aiAnswer(question, context) {
  if (!process.env.OPENAI_API_KEY) {
    return `Demo AI response: Based on the available 30-day data, plan around ${context.prediction.veg} veg and ${context.prediction.nonVeg} non-veg meals tomorrow. Monitor participation and adjust after the next submission cycle.`;
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `You are the Smart Mess Management System's operations assistant.
Give concise, practical answers to an admin. Do not invent data.
30-day data: ${JSON.stringify(context.history)}
Tomorrow prediction: ${JSON.stringify(context.prediction)}
Current stats: ${JSON.stringify(context.today)}
Question: ${question}`;
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4",
    input: prompt
  });
  return response.output_text || "No AI response generated.";
}

export async function aiInsight(context) {
  return aiAnswer("Generate exactly 3 short operational bullet points: preparation quantity, wastage risk, and participation tip.", context);
}
