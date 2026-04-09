const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' })); // Large limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(__dirname));
const fs = require('fs');
const nodemailer = require('nodemailer');

// ══ AUTOMATED DATA BACKUPS ═════════════════════════════
const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

function runDailyBackup() {
    const dbFile = path.join(__dirname, 'campus.sqlite');
    if (!fs.existsSync(dbFile)) return;
    const dateStr = new Date().toISOString().split('T')[0];
    const backupFile = path.join(backupDir, `campus_backup_${dateStr}_${Date.now()}.sqlite`);
    fs.copyFile(dbFile, backupFile, (err) => {
        if (err) console.error('Backup failed:', err);
        else console.log('✅ Daily Database Backup successful:', backupFile);
    });
}
// Run backup soon after boot, then every 24 hours
setTimeout(runDailyBackup, 5000);
setInterval(runDailyBackup, 86400000);

// ══ EMAIL SYSTEM NOTIFICATIONS ═════════════════════════
global.transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'nrshabi123@gmail.com',
        pass: 'nwsb qbfp fnqq rvim'
    }
});
console.log('📧 Gmail SMTP Ready. Live emails will be distributed.');

global.sendSystemEmail = function(to, subject, text, html) {
    if (!global.transporter) return console.log('Email Transporter not ready.');
    global.transporter.sendMail({ from: '"Campus OS" <nrshabi123@gmail.com>', to, subject, text, html }, (err, info) => {
        if (err) console.error('Email Error:', err);
        else console.log(`📩 Mails sent successfully to ${to}!`);
    });
}

// ══ REAL-TIME NOTIFICATIONS (SSE) ═════════════════════
const clients = new Set();
app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write('data: {"event":"connected"}\n\n');
    
    const client = { id: Date.now(), res, role: req.query.role || 'all', user_id: req.query.user_id };
    clients.add(client);
    
    req.on('close', () => {
        clients.delete(client);
    });
});

function broadcast(event, target_role, data) {
    const payload = `data: ${JSON.stringify({ event, ...data })}\n\n`;
    for (const client of clients) {
        if (target_role === 'all' || client.role === target_role || client.role === 'admin' || target_role === 'toast') {
            client.res.write(payload);
        }
    }
}

function isStrongPassword(password) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
}

// ══ AUTH ══════════════════════════════════════════════
app.post('/api/users', (req, res) => {
    const { name, email, password, role } = req.body;
    db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
        [name, email, password, role], function(err) {
            if (err) return res.status(400).json({ error: err.message });
            const userId = this.lastID;
            
            // Email the user their credentials
            const mailText = `Welcome to Campus OS, ${name}!\n\nYour account has been created.\nEmail: ${email}\nPassword: ${password}\n\nPlease log in and change your password immediately.`;
            const mailHtml = `<h3>Welcome to Campus OS, ${name}!</h3><p>Your account has been created.</p><p><b>Email:</b> ${email}<br><b>Password:</b> ${password}</p><p>Please log in and change your password immediately.</p>`;
            if (global.sendSystemEmail) global.sendSystemEmail(email, "Your Campus OS Account Details", mailText, mailHtml);

            res.json({ user_id: userId, message: "User created" });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
        if (err)  return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        const roleMap = { student:`SELECT * FROM students WHERE user_id=?`, faculty:`SELECT * FROM faculty WHERE user_id=?`, worker:`SELECT * FROM workers WHERE user_id=?`, guard:`SELECT * FROM guards WHERE user_id=?` };
        const profileSql = roleMap[user.role];
        const respond = (profile) => res.json({ user_id:user.user_id, name:user.name, email:user.email, role:user.role, profile:profile||null });
        if (profileSql) db.get(profileSql,[user.user_id],(e2,p)=>{ if(e2) return res.status(500).json({error:e2.message}); respond(p); });
        else respond(null);
    });
});

// ══ MOCK GOOGLE AUTH ══════════════════════════════════
app.post('/api/auth/google-link', (req, res) => {
    const { user_id, google_email } = req.body;
    if (!user_id || !google_email) return res.status(400).json({ error: 'Missing parameters' });
    db.run(`UPDATE users SET google_email = ? WHERE user_id = ?`, [google_email, user_id], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Google email already linked to another account' });
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, changes: this.changes });
    });
});

app.post('/api/auth/google-login', (req, res) => {
    const { google_email } = req.body;
    if (!google_email) return res.status(400).json({ error: 'Google email required' });
    
    db.get(`SELECT * FROM users WHERE google_email = ?`, [google_email], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Account Not Linked. Please login normally and link this Google account in Settings.' });
        
        const roleMap = { student:`SELECT * FROM students WHERE user_id=?`, faculty:`SELECT * FROM faculty WHERE user_id=?`, worker:`SELECT * FROM workers WHERE user_id=?`, guard:`SELECT * FROM guards WHERE user_id=?` };
        const profileSql = roleMap[user.role];
        const respond = (profile) => res.json({ user_id:user.user_id, name:user.name, email:user.email, role:user.role, profile:profile||null, google_email:user.google_email });
        if (profileSql) db.get(profileSql,[user.user_id],(e2,p)=>{ if(e2) return res.status(500).json({error:e2.message}); respond(p); });
        else respond(null);
    });
});

// ══ USERS (Admin) ═════════════════════════════════════
app.get('/api/users', (req, res) => {
    db.all(`SELECT user_id,name,email,role,created_at FROM users ORDER BY role,name`,[],(err,rows)=>{
        if(err) return res.status(500).json({error:err.message}); res.json(rows);
    });
});

app.put('/api/users/:id', (req,res) => {
    const{name,email,role}=req.body;
    db.run(`UPDATE users SET name=?,email=?,role=? WHERE user_id=?`,[name,email,role,req.params.id],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
    });
});
app.delete('/api/users/:id', (req,res) => {
    db.run(`DELETE FROM users WHERE user_id=?`,[req.params.id],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
    });
});

// ══ STUDENTS ══════════════════════════════════════════
app.get('/api/students', (req,res) => {
    db.all(`SELECT s.*,u.email FROM students s LEFT JOIN users u ON s.user_id=u.user_id ORDER BY s.name`,[],(err,rows)=>{
        if(err) return res.status(500).json({error:err.message}); res.json(rows);
    });
});
app.post('/api/students', (req,res) => {
    const{name,department,year,program,user_id}=req.body;
    db.run(`INSERT INTO students(name,department,year,program,user_id)VALUES(?,?,?,?,?)`,[name,department,year,program,user_id||null],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({student_id:this.lastID});
    });
});
app.get('/api/students/:id', (req,res) => {
    db.get(`SELECT s.*,u.email FROM students s LEFT JOIN users u ON s.user_id=u.user_id WHERE s.student_id=?`,[req.params.id],(err,row)=>{
        if(err) return res.status(500).json({error:err.message}); if(!row) return res.status(404).json({error:'Not found'}); res.json(row);
    });
});

// ══ FACULTY ════════════════════════════════════════════
app.get('/api/faculty', (req,res) => {
    db.all(`SELECT f.*,u.email FROM faculty f LEFT JOIN users u ON f.user_id=u.user_id ORDER BY f.name`,[],(err,rows)=>{
        if(err) return res.status(500).json({error:err.message}); res.json(rows);
    });
});
app.post('/api/faculty', (req,res) => {
    const{name,department,designation,user_id}=req.body;
    db.run(`INSERT INTO faculty(name,department,designation,user_id)VALUES(?,?,?,?)`,[name,department,designation,user_id||null],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({faculty_id:this.lastID});
    });
});
app.get('/api/faculty/:id/courses', (req,res) => {
    db.all(`SELECT c.*,fc.section FROM courses c JOIN faculty_courses fc ON c.course_id=fc.course_id WHERE fc.faculty_id=?`,[req.params.id],(err,rows)=>{
        if(err) return res.status(500).json({error:err.message}); res.json(rows);
    });
});

// ══ WORKERS ════════════════════════════════════════════
app.get('/api/workers', (req,res) => {
    db.all(`SELECT * FROM workers ORDER BY name`,[],(err,rows)=>{
        if(err) return res.status(500).json({error:err.message}); res.json(rows);
    });
});
app.post('/api/workers', (req,res) => {
    const{name,role_title,department,user_id}=req.body;
    db.run(`INSERT INTO workers(name,role_title,department,user_id)VALUES(?,?,?,?)`,[name,role_title,department,user_id||null],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({worker_id:this.lastID});
    });
});

// ══ GUARDS ════════════════════════════════════════════
app.get('/api/guards', (req,res) => {
    db.all(`SELECT * FROM guards ORDER BY name`,[],(err,rows)=>{
        if(err) return res.status(500).json({error:err.message}); res.json(rows);
    });
});
app.post('/api/guards', (req,res) => {
    const{name,badge_no,user_id}=req.body;
    db.run(`INSERT INTO guards(name,badge_no,user_id)VALUES(?,?,?)`,[name,badge_no,user_id||null],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({guard_id:this.lastID});
    });
});

// ══ COURSES ════════════════════════════════════════════
app.get('/api/courses', (req,res) => {
    db.all(`SELECT * FROM courses ORDER BY department,course_code`,[],(err,rows)=>{
        if(err) return res.status(500).json({error:err.message}); res.json(rows);
    });
});

// ══ TIMETABLE ══════════════════════════════════════════
app.get('/api/timetable', (req,res) => {
    const{section,faculty_id}=req.query;
    let sql=`SELECT t.*,c.course_code,c.course_name,f.name AS faculty_name FROM timetables t JOIN courses c ON t.course_id=c.course_id JOIN faculty f ON t.faculty_id=f.faculty_id`;
    const params=[];
    if(section){sql+=` WHERE t.section=?`;params.push(section);}
    else if(faculty_id){sql+=` WHERE t.faculty_id=?`;params.push(faculty_id);}
    sql+=` ORDER BY t.day_of_week,t.period_no`;
    db.all(sql,params,(err,rows)=>{ if(err) return res.status(500).json({error:err.message}); res.json(rows); });
});
app.post('/api/timetable', (req,res) => {
    const{course_id,faculty_id,section,day_of_week,period_no,start_time,end_time,classroom}=req.body;
    db.get(`SELECT 1 FROM timetables WHERE section=? AND day_of_week=? AND period_no=?`,[section,day_of_week,period_no],(err,ex)=>{
        if(ex) return res.status(409).json({error:'Timetable conflict: slot already booked'});
        db.run(`INSERT INTO timetables(course_id,faculty_id,section,day_of_week,period_no,start_time,end_time,classroom)VALUES(?,?,?,?,?,?,?,?)`,[course_id,faculty_id,section,day_of_week,period_no,start_time,end_time,classroom],function(err2){
            if(err2) return res.status(400).json({error:err2.message}); res.json({timetable_id:this.lastID});
        });
    });
});
app.put('/api/timetable/:id', (req,res) => {
    const{course_id,faculty_id,section,day_of_week,period_no,start_time,end_time,classroom}=req.body;
    const id = req.params.id;
    // Conflict check: another slot (not this one) already occupies same section+day+period
    db.get(`SELECT 1 FROM timetables WHERE section=? AND day_of_week=? AND period_no=? AND timetable_id!=?`,
        [section,day_of_week,period_no,id],(err,ex)=>{
            if(ex) return res.status(409).json({error:'Timetable conflict: that slot is already taken by another class'});
            db.run(`UPDATE timetables SET course_id=?,faculty_id=?,section=?,day_of_week=?,period_no=?,start_time=?,end_time=?,classroom=? WHERE timetable_id=?`,
                [course_id,faculty_id,section,day_of_week,period_no,start_time,end_time,classroom,id],
                function(err2){ if(err2) return res.status(400).json({error:err2.message}); res.json({changes:this.changes}); });
        });
});
app.delete('/api/timetable/:id', (req,res) => {
    db.run(`DELETE FROM timetables WHERE timetable_id=?`,[req.params.id],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
    });
});

// ══ PASSWORD MANAGEMENT ════════════════════════════════
// Self-service: change own password (requires old password)
app.put('/api/auth/change-password', (req,res) => {
    const{user_id, old_password, new_password}=req.body;
    if(!user_id||!old_password||!new_password) return res.status(400).json({error:'user_id, old_password and new_password required'});
    if(!isStrongPassword(new_password)) return res.status(400).json({error:'Password must be 8+ chars and contain upper, lower, number, and special character.'});
    db.get(`SELECT * FROM users WHERE user_id=? AND password=?`,[user_id,old_password],(err,user)=>{
        if(err) return res.status(500).json({error:err.message});
        if(!user) return res.status(401).json({error:'Current password is incorrect'});
        db.run(`UPDATE users SET password=? WHERE user_id=?`,[new_password,user_id],function(err2){
            if(err2) return res.status(400).json({error:err2.message});
            res.json({success:true,message:'Password updated successfully'});
        });
    });
});
// Admin force-reset: set any user's password without needing old one
app.put('/api/users/:id/reset-password', (req,res) => {
    const{new_password}=req.body;
    if(!isStrongPassword(new_password)) return res.status(400).json({error:'Password must be 8+ chars and contain upper, lower, number, and special character.'});
    db.run(`UPDATE users SET password=? WHERE user_id=?`,[new_password,req.params.id],function(err){
        if(err) return res.status(400).json({error:err.message});
        if(this.changes===0) return res.status(404).json({error:'User not found'});
        res.json({success:true,message:'Password reset successfully'});
    });
});

// ══ ATTENDANCE ═════════════════════════════════════════
app.get('/api/attendance', (req,res) => {
    const{student_id,course_id,faculty_id}=req.query;
    let sql=`SELECT a.*,c.course_name,c.course_code,s.name AS student_name FROM attendance a JOIN courses c ON a.course_id=c.course_id JOIN students s ON a.student_id=s.student_id`;
    const params=[],wheres=[];
    if(student_id){wheres.push('a.student_id=?');params.push(student_id);}
    if(course_id){wheres.push('a.course_id=?');params.push(course_id);}
    if(faculty_id){wheres.push('a.faculty_id=?');params.push(faculty_id);}
    if(wheres.length) sql+=' WHERE '+wheres.join(' AND ');
    sql+=' ORDER BY a.date DESC,a.period_no';
    db.all(sql,params,(err,rows)=>{ if(err) return res.status(500).json({error:err.message}); res.json(rows); });
});
// Get students enrolled in a course (via faculty_courses)
app.get('/api/students/by-course/:course_id', (req, res) => {
    db.all(`
        SELECT DISTINCT s.student_id, s.name, s.year, s.program, u.email
        FROM students s
        JOIN users u ON s.user_id = u.user_id
        ORDER BY s.name
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/attendance/summary/:student_id', (req,res) => {
    db.all(`SELECT c.course_id,c.course_code,c.course_name,COUNT(*) AS total,SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present,SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) AS absent,SUM(CASE WHEN a.status='late' THEN 1 ELSE 0 END) AS late FROM attendance a JOIN courses c ON a.course_id=c.course_id WHERE a.student_id=? GROUP BY c.course_id`,[req.params.student_id],(err,rows)=>{
        if(err) return res.status(500).json({error:err.message}); res.json(rows);
    });
});
app.post('/api/attendance', (req,res) => {
    // Accept both single record object OR records[] array
    let records = req.body.records;
    if (!records) {
        // Single record mode — look up student_id and course_id from student/course codes
        const { student_id, course_code, date, status, faculty_id } = req.body;
        db.get(`SELECT course_id FROM courses WHERE course_code=?`, [course_code], (err2, course) => {
            if (err2 || !course) return res.status(400).json({ error: 'Course not found: ' + course_code });
            const fid = faculty_id || 1;
            db.run(`INSERT OR REPLACE INTO attendance(student_id,course_id,faculty_id,date,period_no,status)VALUES(?,?,?,?,1,?)`,
                [student_id, course.course_id, fid, date, status],
                function(err3) { if(err3) return res.status(400).json({error:err3.message}); res.json({message:'1 record saved'}); });
        });
        return;
    }
    if(!records.length) return res.status(400).json({error:'No records'});
    const stmt=db.prepare(`INSERT OR REPLACE INTO attendance(student_id,course_id,faculty_id,date,period_no,status)VALUES(?,?,?,?,?,?)`);
    records.forEach(r=>stmt.run(r.student_id,r.course_id,r.faculty_id,r.date,r.period_no||1,r.status));
    stmt.finalize(err=>{ if(err) return res.status(400).json({error:err.message}); res.json({message:`${records.length} records saved`}); });
});

// ══ NOTICES ════════════════════════════════════════════
app.get('/api/notices', (req,res) => {
    const{role}=req.query;
    let sql=`SELECT n.*,u.name AS posted_by_name FROM notices n LEFT JOIN users u ON n.posted_by=u.user_id`;
    const params=[];
    if(role&&role!=='admin'){sql+=` WHERE n.target_role=? OR n.target_role='all'`;params.push(role);}
    sql+=` ORDER BY n.date_posted DESC`;
    db.all(sql,params,(err,rows)=>{ if(err) return res.status(500).json({error:err.message}); res.json(rows); });
});
app.post('/api/notices', (req,res) => {
    const{title,content,target_role,posted_by,valid_until,image_data,created_by}=req.body;
    const poster = posted_by || created_by;
    db.run(`INSERT INTO notices(title,content,target_role,posted_by,valid_until,image_data)VALUES(?,?,?,?,?,?)`,
        [title,content,target_role||'all',poster,valid_until||null,image_data||null],function(err){
            if(err) return res.status(400).json({error:err.message}); 
            broadcast('notice', target_role||'all', { title, message: content, action: 'refresh_notices' });
            
            // Trigger Email Protocol
            const sql = target_role && target_role !== 'all' ? `SELECT email FROM users WHERE role = ?` : `SELECT email FROM users`;
            const params = target_role && target_role !== 'all' ? [target_role] : [];
            db.all(sql, params, (e, users) => {
                if (!e && users && users.length) {
                    const emails = users.map(u => u.email).join(', ');
                    if (global.sendSystemEmail) global.sendSystemEmail(emails, `New Announcement: ${title}`, content, `<h3>${title}</h3><p>${content}</p>`);
                }
            });
            
            res.json({notice_id:this.lastID});
        });
});
app.delete('/api/notices/:id', (req,res) => {
    db.run(`DELETE FROM notices WHERE notice_id=?`,[req.params.id],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
    });
});
// Clear all notices (admin reset)
app.delete('/api/notices', (req,res) => {
    db.run(`DELETE FROM notices`, [], function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
    });
});
// Clean all user-generated content (queries, public forum)
app.delete('/api/data/user-content', (req,res) => {
    db.run(`DELETE FROM public_queries`, [], () => {
    db.run(`DELETE FROM query_replies`, [], () => {
    db.run(`DELETE FROM queries`, [], () => {
    db.run(`DELETE FROM issue_reports`, [], () => {
        res.json({message:'All user-generated content cleared.'});
    }); }); }); });
});

// ══ QUERIES ════════════════════════════════════════════
app.get('/api/queries', (req,res) => {
    const{student_id,faculty_id}=req.query;
    let sql=`SELECT q.*,s.name AS student_name,f.name AS faculty_name,c.course_name FROM queries q JOIN students s ON q.student_id=s.student_id JOIN faculty f ON q.faculty_id=f.faculty_id JOIN courses c ON q.course_id=c.course_id`;
    const params=[],wheres=[];
    if(student_id){wheres.push('q.student_id=?');params.push(student_id);}
    if(faculty_id){wheres.push('q.faculty_id=?');params.push(faculty_id);}
    if(wheres.length) sql+=' WHERE '+wheres.join(' AND ');
    sql+=' ORDER BY q.created_at DESC';
    db.all(sql,params,(err,rows)=>{ if(err) return res.status(500).json({error:err.message}); res.json(rows); });
});
app.post('/api/queries', (req,res) => {
    const{student_id,faculty_id,course_id,question}=req.body;
    db.run(`INSERT INTO queries(student_id,faculty_id,course_id,question)VALUES(?,?,?,?)`,[student_id,faculty_id,course_id,question],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({query_id:this.lastID});
    });
});
// Both routes for backward compatibility
app.put('/api/queries/:id/respond', (req,res) => {
    const{response}=req.body;
    db.run(`UPDATE queries SET response=?,status='resolved',resolved_at=CURRENT_TIMESTAMP WHERE query_id=?`,[response,req.params.id],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
    });
});
app.put('/api/queries/:id', (req,res) => {
    const{response}=req.body;
    db.run(`UPDATE queries SET response=?,status='resolved',resolved_at=CURRENT_TIMESTAMP WHERE query_id=?`,[response,req.params.id],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
    });
});

// ══ WORKER DUTIES ══════════════════════════════════════
app.get('/api/worker-duties', (req,res) => {
    const{worker_id}=req.query;
    let sql=`SELECT wd.*,w.name AS worker_name FROM worker_duties wd JOIN workers w ON wd.worker_id=w.worker_id`;
    const params=[];
    if(worker_id){sql+=` WHERE wd.worker_id=?`;params.push(worker_id);}
    sql+=` ORDER BY wd.shift_date,wd.shift_start`;
    db.all(sql,params,(err,rows)=>{ if(err) return res.status(500).json({error:err.message}); res.json(rows); });
});

// ══ GUARD SCHEDULES & ALERTS ═══════════════════════════
app.get('/api/guard-schedules', (req,res) => {
    const{guard_id}=req.query;
    let sql=`SELECT gs.*,g.name AS guard_name,g.badge_no FROM guard_schedules gs JOIN guards g ON gs.guard_id=g.guard_id`;
    const params=[];
    if(guard_id){sql+=` WHERE gs.guard_id=?`;params.push(guard_id);}
    sql+=` ORDER BY gs.shift_date,gs.shift_start`;
    db.all(sql,params,(err,rows)=>{ if(err) return res.status(500).json({error:err.message}); res.json(rows); });
});
app.get('/api/security-alerts', (req,res) => {
    db.all(`SELECT * FROM security_alerts ORDER BY issued_at DESC`,[],(err,rows)=>{ if(err) return res.status(500).json({error:err.message}); res.json(rows); });
});
app.post('/api/security-alerts', (req,res) => {
    const{alert_type,location,details,severity}=req.body;
    db.run(`INSERT INTO security_alerts(alert_type,location,details,severity)VALUES(?,?,?,?)`,[alert_type,location,details,severity],function(err){
        if(err) return res.status(400).json({error:err.message}); 
        broadcast('alert', 'all', { title: 'Security Alert: ' + alert_type, message: location, severity, action: 'refresh_alerts' });
        res.json({alert_id:this.lastID});
    });
});
app.put('/api/security-alerts/:id/resolve', (req,res) => {
    db.run(`UPDATE security_alerts SET resolved=1 WHERE alert_id=?`,[req.params.id],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
    });
});

// ══ ISSUE REPORTS (NEW) ════════════════════════════════
app.get('/api/issues', (req,res) => {
    const{student_id,assigned_role,assigned_id,status}=req.query;
    let sql=`SELECT ir.*,s.name AS student_name FROM issue_reports ir LEFT JOIN students s ON ir.student_id=s.student_id`;
    const params=[],wheres=[];
    if(student_id)   { wheres.push('ir.student_id=?');    params.push(student_id); }
    if(assigned_role){ wheres.push('ir.assigned_role=?'); params.push(assigned_role); }
    if(assigned_id)  { wheres.push('ir.assigned_id=?');   params.push(assigned_id); }
    if(status)       { wheres.push('ir.status=?');         params.push(status); }
    if(wheres.length) sql+=' WHERE '+wheres.join(' AND ');
    sql+=' ORDER BY ir.created_at DESC';
    db.all(sql,params,(err,rows)=>{
        if(err) return res.status(500).json({error:err.message});
        // Don't send image_data in list view (too heavy) — strip it down
        const light = rows.map(r => ({ ...r, has_image: !!r.image_data, image_data: undefined }));
        res.json(light);
    });
});

app.get('/api/issues/:id', (req,res) => {
    db.get(`SELECT ir.*,s.name AS student_name FROM issue_reports ir LEFT JOIN students s ON ir.student_id=s.student_id WHERE ir.report_id=?`,[req.params.id],(err,row)=>{
        if(err) return res.status(500).json({error:err.message});
        if(!row) return res.status(404).json({error:'Not found'});
        res.json(row);
    });
});

app.post('/api/issues', (req,res) => {
    const{student_id,title,description,location,category,severity,image_data}=req.body;
    if(!title||!description||!location) return res.status(400).json({error:'Title, description and location required'});
    db.run(`INSERT INTO issue_reports(student_id,title,description,location,category,severity,image_data)VALUES(?,?,?,?,?,?,?)`,
        [student_id,title,description,location,category||'maintenance',severity||'medium',image_data||null],
        function(err){ 
            if(err) return res.status(400).json({error:err.message}); 
            broadcast('issue', 'admin', { title: 'New Issue: ' + title, message: location, action: 'refresh_issues' });
            res.json({report_id:this.lastID}); 
        });
});

app.put('/api/issues/:id/assign', (req,res) => {
    const{assigned_role,assigned_id,assigned_name,admin_notes}=req.body;
    db.run(`UPDATE issue_reports SET assigned_role=?,assigned_id=?,assigned_name=?,admin_notes=?,status='assigned',updated_at=CURRENT_TIMESTAMP WHERE report_id=?`,
        [assigned_role,assigned_id,assigned_name,admin_notes||null,req.params.id],function(err){
            if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
        });
});

app.put('/api/issues/:id/status', (req,res) => {
    const{status}=req.body;
    db.run(`UPDATE issue_reports SET status=?,updated_at=CURRENT_TIMESTAMP WHERE report_id=?`,[status,req.params.id],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
    });
});

app.delete('/api/issues/:id', (req,res) => {
    db.run(`DELETE FROM issue_reports WHERE report_id=?`,[req.params.id],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
    });
});

// ══ PUBLIC FORUM ══════════════════════════════════════
const BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'hello'];
function maskBadWords(text) {
    if (!text) return text;
    let masked = text;
    BAD_WORDS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        masked = masked.replace(regex, '*'.repeat(word.length));
    });
    return masked;
}

app.get('/api/public-queries', (req, res) => {
    db.all(`
        SELECT pq.*, s.name AS student_name, 
               (SELECT COUNT(*) FROM query_replies qr WHERE qr.pq_id = pq.pq_id) AS replies_count
        FROM public_queries pq 
        JOIN students s ON pq.student_id = s.student_id 
        ORDER BY pq.created_at DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/public-queries/:id/replies', (req, res) => {
    db.all(`
        SELECT qr.*, s.name AS student_name 
        FROM query_replies qr 
        JOIN students s ON qr.student_id = s.student_id 
        WHERE qr.pq_id = ? 
        ORDER BY qr.created_at ASC
    `, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/public-queries', (req, res) => {
    const { student_id, title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
    const maskedTitle = maskBadWords(title);
    const maskedContent = maskBadWords(content);
    db.run(`INSERT INTO public_queries (student_id, title, content) VALUES (?, ?, ?)`,
        [student_id, maskedTitle, maskedContent], function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ pq_id: this.lastID });
        });
});

app.post('/api/public-queries/:id/replies', (req, res) => {
    const { student_id, content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });
    const maskedContent = maskBadWords(content);
    db.run(`INSERT INTO query_replies (pq_id, student_id, content) VALUES (?, ?, ?)`,
        [req.params.id, student_id, maskedContent], function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ reply_id: this.lastID });
        });
});

// ══ ADMIN REPORTS ══════════════════════════════════════
app.get('/api/reports/summary', (req,res) => {
    const results={};
    db.get(`SELECT COUNT(*) AS t FROM users`,[],(e,r)=>{ results.total_users=r?.t||0;
    db.get(`SELECT COUNT(*) AS t FROM students`,[],(e,r)=>{ results.total_students=r?.t||0;
    db.get(`SELECT COUNT(*) AS t FROM faculty`,[],(e,r)=>{ results.total_faculty=r?.t||0;
    db.get(`SELECT COUNT(*) AS t FROM notices WHERE date_posted>=date('now','-7 days')`,[],(e,r)=>{ results.notices_this_week=r?.t||0;
    db.get(`SELECT COUNT(*) AS t FROM queries WHERE status='open'`,[],(e,r)=>{ results.open_queries=r?.t||0;
    db.get(`SELECT COUNT(*) AS t FROM attendance WHERE date=date('now')`,[],(e,r)=>{ results.attendance_today=r?.t||0;
    db.get(`SELECT COUNT(*) AS t FROM issue_reports WHERE status='pending'`,[],(e,r)=>{ results.pending_issues=r?.t||0;
        res.json(results);
    }); }); }); }); }); }); });
});
app.get('/api/reports/attendance-by-course', (req,res) => {
    db.all(`SELECT c.course_code,c.course_name,COUNT(*) AS total,ROUND(100.0*SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)/COUNT(*),1) AS pct FROM attendance a JOIN courses c ON a.course_id=c.course_id GROUP BY c.course_id`,[],(err,rows)=>{
        if(err) return res.status(500).json({error:err.message}); res.json(rows);
    });
});

// ══ GEOFENCE ════════════════════════════════════════════
app.post('/api/geofence', (req,res) => {
    const{lat,lng,status}=req.body;
    db.run(`INSERT INTO geofence_logs(lat,lng,status)VALUES(?,?,?)`,[lat,lng,status],function(err){
        if(err) return res.status(500).json({error:err.message}); res.json({id:this.lastID});
    });
});

// ══ SECURITY ALERTS ════════════════════════════════════
app.get('/api/security-alerts', (req,res) => {
    db.all(`SELECT * FROM security_alerts ORDER BY issued_at DESC`, [], (err,rows) => {
        if(err) return res.status(500).json({error:err.message}); res.json(rows||[]);
    });
});
app.post('/api/security-alerts', (req,res) => {
    const{alert_type,location,details,severity}=req.body;
    db.run(`INSERT INTO security_alerts(alert_type,location,details,severity)VALUES(?,?,?,?)`,
        [alert_type,location,details,severity||'medium'],function(err){
            if(err) return res.status(400).json({error:err.message}); 
            broadcast('alert', 'all', { title: 'Security Alert: ' + alert_type, message: location, severity: severity||'medium', action: 'refresh_alerts' });
            res.json({alert_id:this.lastID});
        });
});
app.put('/api/security-alerts/:id/resolve', (req,res) => {
    db.run(`UPDATE security_alerts SET resolved=1,resolved_at=CURRENT_TIMESTAMP WHERE alert_id=?`,
        [req.params.id],function(err){ if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes}); });
});

// ══ GUARD SCHEDULES ════════════════════════════════════
app.get('/api/guard-schedules', (req,res) => {
    let sql = `SELECT gs.*, g.name AS guard_name FROM guard_schedules gs LEFT JOIN guards g ON gs.guard_id=g.guard_id WHERE 1=1`;
    const params = [];
    if(req.query.guard_id){ sql += ` AND gs.guard_id=?`; params.push(req.query.guard_id); }
    sql += ` ORDER BY gs.shift_date, gs.shift_start`;
    db.all(sql, params, (err,rows) => {
        if(err) return res.status(500).json({error:err.message}); res.json(rows||[]);
    });
});
app.post('/api/guard-schedules', (req,res) => {
    const{guard_id,shift_date,shift_start,shift_end,duty_area,post_no}=req.body;
    db.run(`INSERT INTO guard_schedules(guard_id,shift_date,shift_start,shift_end,duty_area,post_no)VALUES(?,?,?,?,?,?)`,
        [guard_id,shift_date,shift_start,shift_end,duty_area,post_no||'A'],function(err){
            if(err) return res.status(400).json({error:err.message}); res.json({schedule_id:this.lastID});
        });
});

// ══ WORKER DUTIES ══════════════════════════════════════
app.get('/api/worker-duties', (req,res) => {
    let sql = `SELECT wd.*, w.name AS worker_name FROM worker_duties wd LEFT JOIN workers w ON wd.worker_id=w.worker_id WHERE 1=1`;
    const params = [];
    if(req.query.worker_id){ sql += ` AND wd.worker_id=?`; params.push(req.query.worker_id); }
    sql += ` ORDER BY wd.duty_date, wd.start_time`;
    db.all(sql, params, (err,rows) => {
        if(err) return res.status(500).json({error:err.message}); res.json(rows||[]);
    });
});
app.put('/api/worker-duties/:id/complete', (req,res) => {
    db.run(`UPDATE worker_duties SET completed=1 WHERE duty_id=?`,[req.params.id],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
    });
});

// ══ NOTICE DELETE ═══════════════════════════════════════
app.delete('/api/notices/:id', (req,res) => {
    db.run(`DELETE FROM notices WHERE notice_id=?`,[req.params.id],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
    });
});

// ══ USER DELETE ══════════════════════════════════════════
app.delete('/api/users/:id', (req,res) => {
    db.run(`DELETE FROM users WHERE user_id=?`,[req.params.id],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
    });
});

// ══ ISSUE SINGLE RECORD (with image) ════════════════════
app.get('/api/issues/:id', (req,res) => {
    db.get(`SELECT ir.*, s.name AS student_name FROM issue_reports ir LEFT JOIN students s ON ir.student_id=s.student_id WHERE ir.report_id=?`,
        [req.params.id],(err,row)=>{
            if(err) return res.status(500).json({error:err.message});
            if(!row) return res.status(404).json({error:'Not found'});
            res.json(row);
        });
});

// ══ SYSTEM SETTINGS ═══════════════════════════════════
app.get('/api/settings/blueprint', (req, res) => {
    db.get(`SELECT setting_value FROM system_settings WHERE setting_key = 'blueprint'`, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ blueprint: row ? row.setting_value : null });
    });
});
app.post('/api/settings/blueprint', (req, res) => {
    const { blueprint } = req.body;
    db.run(`INSERT OR REPLACE INTO system_settings (setting_key, setting_value) VALUES ('blueprint', ?)`, [blueprint], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`\n🎓 Smart Campus Assistant`);
    console.log(`   Server: http://localhost:${PORT}`);
    console.log(`   Login:  http://localhost:${PORT}/index.html\n`);
});
