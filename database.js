const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'campus.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) { console.error('Error opening database', err.message); }
    else { console.log('Connected to SQLite database:', dbPath); initSchema(); }
});

function initSchema() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            user_id     INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            email       TEXT UNIQUE NOT NULL,
            password    TEXT NOT NULL,
            role        TEXT NOT NULL CHECK(role IN ('admin','student','faculty','worker','guard')),
            google_email TEXT UNIQUE,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS students (
            student_id  INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            department  TEXT NOT NULL,
            year        INTEGER NOT NULL,
            program     TEXT NOT NULL,
            user_id     INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS faculty (
            faculty_id  INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            department  TEXT NOT NULL,
            designation TEXT NOT NULL,
            user_id     INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS workers (
            worker_id   INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            role_title  TEXT NOT NULL,
            department  TEXT NOT NULL,
            user_id     INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS guards (
            guard_id    INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            badge_no    TEXT UNIQUE NOT NULL,
            user_id     INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS courses (
            course_id   INTEGER PRIMARY KEY AUTOINCREMENT,
            course_code TEXT UNIQUE NOT NULL,
            course_name TEXT NOT NULL,
            department  TEXT NOT NULL,
            credits     INTEGER NOT NULL
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS faculty_courses (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            faculty_id  INTEGER REFERENCES faculty(faculty_id),
            course_id   INTEGER REFERENCES courses(course_id),
            section     TEXT NOT NULL,
            UNIQUE(faculty_id, course_id, section)
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS timetables (
            timetable_id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id    INTEGER REFERENCES courses(course_id),
            faculty_id   INTEGER REFERENCES faculty(faculty_id),
            section      TEXT NOT NULL,
            day_of_week  TEXT NOT NULL CHECK(day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
            period_no    INTEGER NOT NULL,
            start_time   TEXT NOT NULL,
            end_time     TEXT NOT NULL,
            classroom    TEXT NOT NULL
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS attendance (
            attendance_id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id   INTEGER REFERENCES students(student_id),
            course_id    INTEGER REFERENCES courses(course_id),
            faculty_id   INTEGER REFERENCES faculty(faculty_id),
            date         TEXT NOT NULL,
            period_no    INTEGER NOT NULL,
            status       TEXT NOT NULL CHECK(status IN ('present','absent','late')),
            marked_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS notices (
            notice_id   INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            content     TEXT NOT NULL,
            target_role TEXT NOT NULL DEFAULT 'all',
            posted_by   INTEGER REFERENCES users(user_id),
            date_posted DATETIME DEFAULT CURRENT_TIMESTAMP,
            valid_until TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS queries (
            query_id    INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id  INTEGER REFERENCES students(student_id),
            faculty_id  INTEGER REFERENCES faculty(faculty_id),
            course_id   INTEGER REFERENCES courses(course_id),
            question    TEXT NOT NULL,
            response    TEXT,
            status      TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS worker_duties (
            duty_id     INTEGER PRIMARY KEY AUTOINCREMENT,
            worker_id   INTEGER REFERENCES workers(worker_id),
            shift_date  TEXT NOT NULL,
            shift_start TEXT NOT NULL,
            shift_end   TEXT NOT NULL,
            location    TEXT NOT NULL,
            task        TEXT NOT NULL,
            status      TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled'))
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS guard_schedules (
            schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
            guard_id    INTEGER REFERENCES guards(guard_id),
            shift_date  TEXT NOT NULL,
            shift_start TEXT NOT NULL,
            shift_end   TEXT NOT NULL,
            duty_area   TEXT NOT NULL,
            post_no     TEXT NOT NULL
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS security_alerts (
            alert_id    INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_type  TEXT NOT NULL,
            location    TEXT NOT NULL,
            details     TEXT NOT NULL,
            severity    TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
            issued_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved    INTEGER DEFAULT 0
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS geofence_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            lat         TEXT, lng TEXT, status TEXT,
            timestamp   DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        /* ── NEW: Public Queries / Forum ── */
        db.run(`CREATE TABLE IF NOT EXISTS public_queries (
            pq_id       INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id  INTEGER REFERENCES students(student_id),
            title       TEXT NOT NULL,
            content     TEXT NOT NULL,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        /* ── NEW: System Settings Table ── */
        db.run(`CREATE TABLE IF NOT EXISTS system_settings (
            setting_key   TEXT PRIMARY KEY,
            setting_value TEXT
        )`);

        /* ── Security Alerts ── */
        db.run(`CREATE TABLE IF NOT EXISTS security_alerts (
            alert_id    INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_type  TEXT NOT NULL,
            location    TEXT NOT NULL,
            details     TEXT,
            severity    TEXT DEFAULT 'medium',
            resolved    INTEGER DEFAULT 0,
            resolved_at DATETIME,
            issued_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        /* ── Guard Schedules ── */
        db.run(`CREATE TABLE IF NOT EXISTS guard_schedules (
            schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
            guard_id    INTEGER REFERENCES guards(guard_id),
            shift_date  TEXT NOT NULL,
            shift_start TEXT NOT NULL,
            shift_end   TEXT NOT NULL,
            duty_area   TEXT NOT NULL,
            post_no     TEXT DEFAULT 'A'
        )`);

        /* ── Worker Duties ── */
        db.run(`CREATE TABLE IF NOT EXISTS worker_duties (
            duty_id          INTEGER PRIMARY KEY AUTOINCREMENT,
            worker_id        INTEGER REFERENCES workers(worker_id),
            duty_date        TEXT NOT NULL,
            start_time       TEXT NOT NULL,
            end_time         TEXT NOT NULL,
            task_description TEXT NOT NULL,
            location         TEXT,
            completed        INTEGER DEFAULT 0
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS query_replies (
            reply_id    INTEGER PRIMARY KEY AUTOINCREMENT,
            pq_id       INTEGER REFERENCES public_queries(pq_id) ON DELETE CASCADE,
            student_id  INTEGER REFERENCES students(student_id),
            content     TEXT NOT NULL,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        /* ── NEW: Issue Reports Table ── */
        db.run(`CREATE TABLE IF NOT EXISTS issue_reports (
            report_id     INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id    INTEGER REFERENCES students(student_id),
            title         TEXT NOT NULL,
            description   TEXT NOT NULL,
            location      TEXT NOT NULL,
            category      TEXT NOT NULL DEFAULT 'maintenance'
                          CHECK(category IN ('maintenance','security','cleanliness','electrical','emergency','other')),
            severity      TEXT NOT NULL DEFAULT 'medium'
                          CHECK(severity IN ('low','medium','high','critical')),
            image_data    TEXT,
            status        TEXT NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending','assigned','in_progress','resolved')),
            assigned_role TEXT CHECK(assigned_role IN ('worker','guard',NULL)),
            assigned_id   INTEGER,
            assigned_name TEXT,
            admin_notes   TEXT,
            created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME
        )`);

        db.get("SELECT COUNT(*) AS cnt FROM users", (err, row) => {
            if (err || row.cnt > 0) return;

            const uStmt = db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`);
            uStmt.run("Admin Singh",      "admin@campus.edu",   "Admin@123",   "admin");
            uStmt.run("Mehul Krishna",    "student@campus.edu", "Student@123", "student");
            uStmt.run("Dr. Ramesh Nair",  "faculty@campus.edu", "Faculty@123", "faculty");
            uStmt.run("Suresh Kumar",     "worker@campus.edu",  "Worker@123",  "worker");
            uStmt.run("Kamleshbhai",      "guard@campus.edu",   "Guard@123",   "guard");
            uStmt.finalize();

            const sStmt = db.prepare(`INSERT INTO students (name, department, year, program, user_id) VALUES (?, ?, ?, ?, ?)`);
            sStmt.run("Mehul Krishna", "Computer Science", 2, "B.Tech", 2);
            sStmt.run("Anjan Prasad",  "Electronics",      3, "B.Tech", null);
            sStmt.run("Yuvaraju",      "Mechanical",       1, "B.Tech", null);
            sStmt.run("Rohith",        "Computer Science", 2, "B.Tech", null);
            sStmt.run("Sneha Pillai",  "Civil",            4, "B.Tech", null);
            sStmt.finalize();

            const fStmt = db.prepare(`INSERT INTO faculty (name, department, designation, user_id) VALUES (?, ?, ?, ?)`);
            fStmt.run("Dr. Ramesh Nair",   "Computer Science", "Associate Professor", 3);
            fStmt.run("Prof. Anita Joshi", "Electronics",      "Assistant Professor", null);
            fStmt.run("Dr. Vijay Patil",   "Mathematics",      "Professor",           null);
            fStmt.finalize();

            const wStmt = db.prepare(`INSERT INTO workers (name, role_title, department, user_id) VALUES (?, ?, ?, ?)`);
            wStmt.run("Suresh Kumar", "Electrician", "Maintenance", 4);
            wStmt.run("Ravi Yadav",   "Plumber",     "Maintenance", null);
            wStmt.run("Mohan Lal",    "Housekeeper", "Sanitation",  null);
            wStmt.finalize();

            const gStmt = db.prepare(`INSERT INTO guards (name, badge_no, user_id) VALUES (?, ?, ?)`);
            gStmt.run("Kamleshbhai", "GRD-001", 5);
            gStmt.run("Abhay",       "GRD-002", null);
            gStmt.finalize();

            const cStmt = db.prepare(`INSERT INTO courses (course_code, course_name, department, credits) VALUES (?, ?, ?, ?)`);
            cStmt.run("CS202", "Software Engineering",          "Computer Science", 4);
            cStmt.run("CS204", "DBMS",                          "Computer Science", 3);
            cStmt.run("CS206", "System Software",               "Computer Science", 4);
            cStmt.run("MA201", "Engineering Mathematics III",   "Mathematics",      3);
            cStmt.run("EC301", "Signals & Systems",             "Electronics",      3);
            cStmt.finalize();

            const fcStmt = db.prepare(`INSERT INTO faculty_courses (faculty_id, course_id, section) VALUES (?, ?, ?)`);
            fcStmt.run(1,1,"CS-A"); fcStmt.run(1,2,"CS-A"); fcStmt.run(1,3,"CS-A");
            fcStmt.run(3,4,"CS-A"); fcStmt.run(2,5,"EC-A");
            fcStmt.finalize();

            const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
            const slots = [[1,1,"09:00","09:55","LH-101"],[2,2,"10:00","10:55","LH-102"],[3,3,"11:00","11:55","LH-103"],[4,1,"14:00","14:55","LH-101"]];
            const ttStmt = db.prepare(`INSERT INTO timetables (course_id, faculty_id, section, day_of_week, period_no, start_time, end_time, classroom) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
            DAYS.forEach(day => slots.forEach(([cid,fid,st,et,room],i) => ttStmt.run(cid,fid,"CS-A",day,i+1,st,et,room)));
            ttStmt.finalize();

            const attStmt = db.prepare(`INSERT INTO attendance (student_id, course_id, faculty_id, date, period_no, status) VALUES (?, ?, ?, ?, ?, ?)`);
            const dateArr = [];
            for (let i=14;i>=1;i--){ const d=new Date(); d.setDate(d.getDate()-i); if(d.getDay()>0&&d.getDay()<6) dateArr.push(d.toISOString().split('T')[0]); }
            const statuses = ["present","present","present","absent","present","present","late","present","present","absent"];
            dateArr.slice(0,10).forEach((date,idx) => [1,2,3].forEach(cid => attStmt.run(1,cid,1,date,1,statuses[idx])));
            attStmt.finalize();

            const nStmt = db.prepare(`INSERT INTO notices (title, content, target_role, posted_by, valid_until) VALUES (?, ?, ?, ?, ?)`);
            nStmt.run("Mid-Semester Examination Schedule","Mid-sem exams will be held from April 20–26. Hall tickets available by April 15.","student",1,"2026-04-26");
            nStmt.run("Campus Fest Registration Open","Annual campus fest registrations are open. Last date: April 12.","all",1,"2026-04-12");
            nStmt.run("Faculty Meeting — April 10","All faculty required to attend the academic review on April 10 at 3:00 PM.","faculty",1,"2026-04-10");
            nStmt.run("Maintenance: Block C Water Supply","Water supply in Block C interrupted April 8 from 9AM–1PM for pipeline repairs.","all",1,"2026-04-08");
            nStmt.run("Security Drill — April 9","Mandatory campus security drill on April 9. All guards must report by 7:00 AM.","guard",1,"2026-04-09");
            nStmt.run("Shift Rotation Update","Worker shift allocations for April Week 2 have been updated. Check duty schedule.","worker",1,"2026-04-14");
            nStmt.finalize();

            const qStmt = db.prepare(`INSERT INTO queries (student_id, faculty_id, course_id, question, response, status) VALUES (?, ?, ?, ?, ?, ?)`);
            qStmt.run(1,1,1,"Can you explain the time complexity of QuickSort in worst case?","In worst case (already sorted with naive pivot), QuickSort is O(n²). Use randomized pivot to avoid this.","resolved");
            qStmt.run(1,1,2,"What is the difference between 2NF and 3NF?",null,"open");
            qStmt.run(2,1,1,"Which sorting algorithm is best for nearly sorted data?","Insertion Sort with O(n) best-case complexity is ideal.","resolved");
            qStmt.run(3,1,3,"How does Round-Robin scheduling work?",null,"open");
            qStmt.finalize();

            const today = new Date().toISOString().split('T')[0];
            const tomorrow = new Date(Date.now()+86400000).toISOString().split('T')[0];
            const wdStmt = db.prepare(`INSERT INTO worker_duties (worker_id, shift_date, shift_start, shift_end, location, task, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            wdStmt.run(1,today,"06:00","14:00","Block A","Electrical Panel Inspection","scheduled");
            wdStmt.run(1,today,"14:00","18:00","Lab Complex","Generator Maintenance","scheduled");
            wdStmt.run(1,tomorrow,"06:00","14:00","Block B","AC Unit Servicing","scheduled");
            wdStmt.run(2,today,"08:00","16:00","Hostel Block","Pipeline Leak Repair","scheduled");
            wdStmt.run(3,today,"07:00","15:00","Main Building","General Cleaning","completed");
            wdStmt.finalize();

            const gsStmt = db.prepare(`INSERT INTO guard_schedules (guard_id, shift_date, shift_start, shift_end, duty_area, post_no) VALUES (?, ?, ?, ?, ?, ?)`);
            gsStmt.run(1,today,"06:00","14:00","Main Gate","POST-01");
            gsStmt.run(1,today,"14:00","22:00","Academic Block","POST-03");
            gsStmt.run(1,tomorrow,"22:00","06:00","Hostel Perimeter","POST-05");
            gsStmt.run(2,today,"06:00","14:00","Parking Zone","POST-02");
            gsStmt.finalize();

            const saStmt = db.prepare(`INSERT INTO security_alerts (alert_type, location, details, severity, resolved) VALUES (?, ?, ?, ?, ?)`);
            saStmt.run("Unauthorized Access","Server Room — Block D","Unidentified person spotted near server room.","high",0);
            saStmt.run("Vehicle Alert","Parking Zone B","Vehicle without valid permit detected.","medium",1);
            saStmt.run("Fire Alarm Triggered","Chemistry Lab","Fire alarm triggered in Chem Lab. Investigation ongoing.","critical",1);
            saStmt.run("Equipment Tampering","Main Gate Barrier","Gate barrier sensor shows unusual activity.","low",0);
            saStmt.finalize();

            const irStmt = db.prepare(`INSERT INTO issue_reports (student_id, title, description, location, category, severity, status, assigned_role, assigned_id, assigned_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            irStmt.run(1,"Cooler Not Working in LH-101","The ceiling cooler in Lecture Hall 101 has been non-functional for 2 days. Extremely hot during afternoon lectures.","LH-101, Academic Block","maintenance","high","assigned","worker",1,"Suresh Kumar");
            irStmt.run(2,"Broken Window — Hostel Block E","Window pane near staircase in Hostel Block E is cracked and poses a safety risk.","Hostel Block E, 2nd Floor","maintenance","medium","pending",null,null,null);
            irStmt.run(3,"Fight Near Cafeteria","Two students involved in a physical altercation near the cafeteria entrance. Required immediate intervention.","Cafeteria, Block F","security","critical","resolved","guard",1,"Kamleshbhai");
            irStmt.finalize();

            /* Seed sample public queries */
            const pqStmt = db.prepare(`INSERT INTO public_queries (student_id, title, content) VALUES (?, ?, ?)`);
            pqStmt.run(1, "Hackathon Partners", "Anyone looking for a frontend dev for the upcoming AI hackathon?");
            pqStmt.run(2, "Library Hours during exams", "Does anyone know if the library will be open 24/7 during mid-sems?");
            pqStmt.finalize();

            const qrStmt = db.prepare(`INSERT INTO query_replies (pq_id, student_id, content) VALUES (?, ?, ?)`);
            qrStmt.run(1, 2, "I need a frontend dev! Let's team up.");
            qrStmt.run(2, 3, "Yes, usually starts being 24/7 a week before exams.");
            qrStmt.finalize();

            /* Seed default settings */
            const setStmt = db.prepare(`INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)`);
            setStmt.run('blueprint', '');
            setStmt.finalize();
        });
    });
}

module.exports = db;
