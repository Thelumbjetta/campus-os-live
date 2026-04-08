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

// ══ AUTH ══════════════════════════════════════════════
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
app.post('/api/users', (req,res) => {
    const{name,email,password,role}=req.body;
    db.run(`INSERT INTO users(name,email,password,role)VALUES(?,?,?,?)`,[name,email,password,role],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({user_id:this.lastID});
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

// ══ GUARDS ════════════════════════════════════════════
app.get('/api/guards', (req,res) => {
    db.all(`SELECT * FROM guards ORDER BY name`,[],(err,rows)=>{
        if(err) return res.status(500).json({error:err.message}); res.json(rows);
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
app.delete('/api/timetable/:id', (req,res) => {
    db.run(`DELETE FROM timetables WHERE timetable_id=?`,[req.params.id],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
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
app.get('/api/attendance/summary/:student_id', (req,res) => {
    db.all(`SELECT c.course_id,c.course_code,c.course_name,COUNT(*) AS total,SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present,SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) AS absent,SUM(CASE WHEN a.status='late' THEN 1 ELSE 0 END) AS late FROM attendance a JOIN courses c ON a.course_id=c.course_id WHERE a.student_id=? GROUP BY c.course_id`,[req.params.student_id],(err,rows)=>{
        if(err) return res.status(500).json({error:err.message}); res.json(rows);
    });
});
app.post('/api/attendance', (req,res) => {
    const{records}=req.body;
    if(!records||!records.length) return res.status(400).json({error:'No records'});
    const stmt=db.prepare(`INSERT OR REPLACE INTO attendance(student_id,course_id,faculty_id,date,period_no,status)VALUES(?,?,?,?,?,?)`);
    records.forEach(r=>stmt.run(r.student_id,r.course_id,r.faculty_id,r.date,r.period_no,r.status));
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
    const{title,content,target_role,posted_by,valid_until}=req.body;
    db.run(`INSERT INTO notices(title,content,target_role,posted_by,valid_until)VALUES(?,?,?,?,?)`,[title,content,target_role||'all',posted_by,valid_until||null],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({notice_id:this.lastID});
    });
});
app.delete('/api/notices/:id', (req,res) => {
    db.run(`DELETE FROM notices WHERE notice_id=?`,[req.params.id],function(err){
        if(err) return res.status(400).json({error:err.message}); res.json({changes:this.changes});
    });
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
app.put('/api/queries/:id/respond', (req,res) => {
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
        if(err) return res.status(400).json({error:err.message}); res.json({alert_id:this.lastID});
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
        function(err){ if(err) return res.status(400).json({error:err.message}); res.json({report_id:this.lastID}); });
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

// ══ PUBLIC FORUM (NEW) ══════════════════════════════════
const BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick'];
function maskBadWords(text) {
    if (!text) return text;
    let masked = text;
    BAD_WORDS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        masked = masked.replace(regex, '****');
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

app.listen(PORT, () => {
    console.log(`\n🎓 Smart Campus Assistant`);
    console.log(`   Server: http://localhost:${PORT}`);
    console.log(`   Login:  http://localhost:${PORT}/index.html\n`);
});
