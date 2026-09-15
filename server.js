import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const db = new Database(process.env.DB_FILE || path.join(__dirname, "data", "midad.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grade_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  grade TEXT,
  subject TEXT,
  description TEXT,
  url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  grade TEXT,
  subject TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);
`);

const adminUser = process.env.ADMIN_USERNAME || "k617g";
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) {
  console.warn("ADMIN_PASSWORD is not set. Add it to .env before using admin login.");
} else {
  const exists = db.prepare("SELECT id FROM users WHERE username=?").get(adminUser);
  if (!exists) {
    const hash = bcrypt.hashSync(adminPassword, 12);
    db.prepare("INSERT INTO users(username,password_hash,role,name) VALUES(?,?,?,?)")
      .run(adminUser, hash, "admin", "عمر البلوشي");
  }
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-secret-before-production",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 1000*60*60*8 }
}));
app.use(express.static(path.join(__dirname, "public")));

function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({error:"يجب تسجيل الدخول"});
  next();
}
function admin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") return res.status(403).json({error:"غير مصرح"});
  next();
}

app.get("/api/me", (req,res)=>res.json({user:req.session.user || null}));

app.post("/api/login", (req,res)=>{
  const {username,password}=req.body;
  const user=db.prepare("SELECT * FROM users WHERE username=?").get(username);
  if (!user || !bcrypt.compareSync(password || "", user.password_hash))
    return res.status(401).json({error:"بيانات الدخول غير صحيحة"});
  req.session.user={id:user.id,username:user.username,role:user.role,name:user.name};
  res.json({ok:true,user:req.session.user});
});

app.post("/api/register", (req,res)=>{
  const {username,password,name}=req.body;
  if(!username || !password || password.length<8) return res.status(400).json({error:"اسم المستخدم وكلمة المرور مطلوبان، وكلمة المرور 8 أحرف على الأقل"});
  try {
    const hash=bcrypt.hashSync(password,12);
    const info=db.prepare("INSERT INTO users(username,password_hash,role,name) VALUES(?,?,?,?)")
      .run(username,hash,"student",name||username);
    req.session.user={id:info.lastInsertRowid,username,role:"student",name:name||username};
    res.json({ok:true,user:req.session.user});
  } catch {
    res.status(409).json({error:"اسم المستخدم مستخدم بالفعل"});
  }
});

app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.get("/api/grades",(req,res)=>res.json(db.prepare("SELECT * FROM grades ORDER BY id DESC").all()));
app.get("/api/subjects",(req,res)=>res.json(db.prepare(`
SELECT subjects.*, grades.name AS grade_name FROM subjects JOIN grades ON grades.id=subjects.grade_id ORDER BY subjects.id DESC
`).all()));

app.get("/api/content",(req,res)=>{
  res.json(db.prepare("SELECT * FROM contents ORDER BY id DESC").all());
});

app.post("/api/admin/grade",admin,(req,res)=>{
  const {name}=req.body;
  if(!name) return res.status(400).json({error:"اسم الصف مطلوب"});
  try { db.prepare("INSERT INTO grades(name) VALUES(?)").run(name); res.json({ok:true}); }
  catch { res.status(409).json({error:"الصف موجود"}); }
});

app.delete("/api/admin/grade/:id",admin,(req,res)=>{
  db.prepare("DELETE FROM grades WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

app.post("/api/admin/subject",admin,(req,res)=>{
  const {grade_id,name}=req.body;
  if(!grade_id||!name) return res.status(400).json({error:"البيانات ناقصة"});
  db.prepare("INSERT INTO subjects(grade_id,name) VALUES(?,?)").run(grade_id,name);
  res.json({ok:true});
});

app.delete("/api/admin/subject/:id",admin,(req,res)=>{
  db.prepare("DELETE FROM subjects WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

app.post("/api/admin/content",admin,(req,res)=>{
  const {title,type,grade,subject,description,url}=req.body;
  if(!title||!type) return res.status(400).json({error:"العنوان والنوع مطلوبان"});
  db.prepare(`INSERT INTO contents(title,type,grade,subject,description,url) VALUES(?,?,?,?,?,?)`)
    .run(title,type,grade||"",subject||"",description||"",url||"");
  res.json({ok:true});
});

app.put("/api/admin/content/:id",admin,(req,res)=>{
  const {title,type,grade,subject,description,url}=req.body;
  db.prepare(`UPDATE contents SET title=?,type=?,grade=?,subject=?,description=?,url=? WHERE id=?`)
    .run(title,type,grade||"",subject||"",description||"",url||"",req.params.id);
  res.json({ok:true});
});

app.delete("/api/admin/content/:id",admin,(req,res)=>{
  db.prepare("DELETE FROM contents WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

app.get("/api/quizzes",(req,res)=>{
  const quizzes=db.prepare("SELECT * FROM quizzes ORDER BY id DESC").all();
  for(const q of quizzes) q.questions=db.prepare("SELECT id,question,options_json FROM questions WHERE quiz_id=?").all(q.id).map(x=>({...x,options:JSON.parse(x.options_json)}));
  res.json(quizzes);
});

app.post("/api/admin/quiz",admin,(req,res)=>{
  const {title,grade,subject,questions=[]}=req.body;
  if(!title) return res.status(400).json({error:"اسم الاختبار مطلوب"});
  const tx=db.transaction(()=>{
    const q=db.prepare("INSERT INTO quizzes(title,grade,subject) VALUES(?,?,?)").run(title,grade||"",subject||"");
    for(const item of questions){
      if(item.question && Array.isArray(item.options) && item.options.length>=2)
        db.prepare("INSERT INTO questions(quiz_id,question,options_json,correct_index) VALUES(?,?,?,?)")
          .run(q.lastInsertRowid,item.question,JSON.stringify(item.options),Number(item.correct_index||0));
    }
  });
  tx(); res.json({ok:true});
});

app.delete("/api/admin/quiz/:id",admin,(req,res)=>{
  db.prepare("DELETE FROM questions WHERE quiz_id=?").run(req.params.id);
  db.prepare("DELETE FROM quizzes WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

let openai=null;
if(process.env.OPENAI_API_KEY) openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});

app.post("/api/ai/chat",auth,async(req,res)=>{
  if(!openai) return res.status(503).json({error:"مساعد الذكاء الاصطناعي غير مفعّل. أضف OPENAI_API_KEY إلى ملف .env."});
  const message=String(req.body.message||"").trim();
  if(!message) return res.status(400).json({error:"اكتب سؤالك أولاً"});
  try{
    const response=await openai.responses.create({
      model:process.env.OPENAI_MODEL||"gpt-5.6-luna",
      instructions:"أنت مساعد تعليمي عربي داخل منصة مِداد التعليمية لطلاب سلطنة عُمان. اشرح بلغة عربية واضحة ومناسبة للطلاب، ولا تدّعِ أن إجابتك من المنهج العُماني إذا لم تكن متأكدًا. ساعد الطالب على الفهم خطوة بخطوة بدل إعطاء إجابة بلا شرح.",
      input:message
    });
    res.json({answer:response.output_text||"لم أستطع تكوين إجابة."});
  }catch(e){
    console.error(e);
    res.status(500).json({error:"حدث خطأ أثناء الاتصال بمساعد الذكاء الاصطناعي"});
  }
});

app.get(/.*/,(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`Midad running on http://localhost:${port}`));
