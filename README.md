Smart Mess Management System

A full-stack web app that digitizes hostel/college mess (dining hall) operations — helping students declare their daily meals and giving admins live analytics, AI planning, and waste control. Built with React + FastAPI + MongoDB, with a clean green/white/blue interface and dark mode.

Who uses it
Students — mark whether they'll eat and their veg/non-veg choice each day.
Admins — manage menus, monitor attendance, and plan food quantities.

What it does
🔐 Login

Email/password (JWT) login for both students and admins, plus Google login.
Demo: Admin kumarashishsingh920@gmail.com / admin123, Student student1@example.com / student123.
🎓 Student side

See today's breakfast, lunch & dinner menu with the current date.
Mark "I will eat / won't eat" and Veg / Non-Veg, editable until the deadline, with a confirmation message.
QR mess check-in — a personal QR code to confirm attendance at the counter.
Editable profile (name, roll number, hostel block) and in-app notifications.

🛠️ Admin side

Dashboard: total students, eating today, veg/non-veg/absent counts, a pie breakdown and a 30-day trend chart.
AI Demand Prediction: statistical forecast of tomorrow's veg & non-veg needs from 30 days of data.
ChatGPT AI (gpt-5.4): an AI Insight card (auto tips on how much to cook, wastage risk, participation) and a Mess AI Assistant chat for planning questions.
Student search, Meal Management (edit today's menu), Settings (deadline, notification toggles).
Reports: daily/weekly/monthly stats + food wastage estimation, exportable as PDF or Excel.
Email reminders to students who haven't submitted (via Resend).

🎨 Experience

Sidebar-navigation dashboard, cards, charts, tables, smooth animations, fully mobile-responsive, light/dark theme.
Under the hood
Demo data auto-seeds ~40 students with 30 days of attendance and menus, refreshed on every startup so charts and predictions are always populated.
Role-based access: students can't reach admin-only features; sessions use secure httpOnly cookies.
In short: students declare meals in seconds, admins get real-time insight and AI-driven guidance to cook the right amount and cut food waste.
