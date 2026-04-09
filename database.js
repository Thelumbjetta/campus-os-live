const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_5sw1GdCBaoAe@ep-purple-bird-amzww2ua-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

function convertQuery(sql) {
    let i=1; 
    let pSql = sql.replace(/\?/g, function() { return '$' + (i++); });
    if(pSql.trim().toUpperCase().startsWith('INSERT') && !pSql.toUpperCase().includes('RETURNING')) { 
        pSql += ' RETURNING *'; 
    } 
    return pSql; 
}

const db = {
  run: function(sql, params=[], cb) { 
      if(typeof params==='function') { cb=params; params=[]; } 
      pool.query(convertQuery(sql), params)
          .then(r => { 
              let lastID = r.rows && r.rows[0] ? Object.values(r.rows[0])[0] : null; 
              if(cb) cb.call({lastID, changes:r.rowCount}, null); 
          })
          .catch(e => cb && cb(e)); 
  },
  all: function(sql, params, cb) { 
      if(typeof params==='function') { cb=params; params=[]; } 
      pool.query(convertQuery(sql), params)
          .then(r => { if(cb) cb(null, r.rows); })
          .catch(e => cb && cb(e)); 
  },
  get: function(sql, params, cb) { 
      if(typeof params==='function') { cb=params; params=[]; } 
      pool.query(convertQuery(sql), params)
          .then(r => { if(cb) cb(null, r.rows[0]||null); })
          .catch(e => cb && cb(e)); 
  },
  serialize: function(cb) { cb(); },
  getInternalPool: () => pool
};

pool.connect((err) => {
  if (err) console.error('Error connecting to Neon Postgres:', err);
  else { console.log('Connected to Neon PostgreSQL Database!'); initSchema(); }
});

function initSchema() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            user_id     SERIAL PRIMARY KEY,
            name        TEXT NOT NULL,
            email       TEXT UNIQUE NOT NULL,
            password    TEXT NOT NULL,
            role        TEXT NOT NULL CHECK(role IN ('admin','student','faculty','worker','guard')),
            google_email TEXT UNIQUE,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS students (
            student_id  SERIAL PRIMARY KEY,
            name        TEXT NOT NULL,
            department  TEXT NOT NULL,
            year        INTEGER NOT NULL,
            program     TEXT NOT NULL,
            user_id     INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS faculty (
            faculty_id  SERIAL PRIMARY KEY,
            name        TEXT NOT NULL,
            department  TEXT NOT NULL,
            designation TEXT NOT NULL,
            user_id     INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS workers (
            worker_id   SERIAL PRIMARY KEY,
            name        TEXT NOT NULL,
            role_title  TEXT NOT NULL,
            user_id     INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS guards (
            guard_id    SERIAL PRIMARY KEY,
            name        TEXT NOT NULL,
            badge_no    TEXT NOT NULL UNIQUE,
            user_id     INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS courses (
            course_id   SERIAL PRIMARY KEY,
            course_code TEXT UNIQUE NOT NULL,
            course_name TEXT NOT NULL,
            credits     INTEGER NOT NULL,
            faculty_id  INTEGER REFERENCES faculty(faculty_id)
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS course_registrations (
            registration_id SERIAL PRIMARY KEY,
            student_id      INTEGER REFERENCES students(student_id) ON DELETE CASCADE,
            course_id       INTEGER REFERENCES courses(course_id) ON DELETE CASCADE,
            registered_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(student_id, course_id)
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS attendance (
            attendance_id   SERIAL PRIMARY KEY,
            course_id       INTEGER REFERENCES courses(course_id),
            student_id      INTEGER REFERENCES students(student_id),
            date            DATE NOT NULL,
            status          TEXT NOT NULL CHECK(status IN ('present','absent','late')),
            recorded_by     INTEGER REFERENCES faculty(faculty_id),
            UNIQUE(course_id, student_id, date)
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS notices (
            notice_id   SERIAL PRIMARY KEY,
            title       TEXT NOT NULL,
            content     TEXT NOT NULL,
            target_role TEXT NOT NULL DEFAULT 'all',
            posted_by   INTEGER REFERENCES users(user_id),
            date_posted TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            valid_until TEXT,
            image_data  TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS queries (
            query_id    SERIAL PRIMARY KEY,
            student_id  INTEGER REFERENCES students(student_id),
            faculty_id  INTEGER REFERENCES faculty(faculty_id),
            course_id   INTEGER REFERENCES courses(course_id),
            title       TEXT NOT NULL,
            query_text  TEXT NOT NULL,
            reply_text  TEXT,
            status      TEXT DEFAULT 'pending' CHECK(status IN ('pending','answered')),
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            replied_at  TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS public_queries (
            pq_id       SERIAL PRIMARY KEY,
            student_id  INTEGER REFERENCES students(student_id),
            title       TEXT NOT NULL,
            content     TEXT NOT NULL,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS query_replies (
            reply_id    SERIAL PRIMARY KEY,
            pq_id       INTEGER REFERENCES public_queries(pq_id) ON DELETE CASCADE,
            student_id  INTEGER REFERENCES students(student_id),
            content     TEXT NOT NULL,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS issue_reports (
            report_id     SERIAL PRIMARY KEY,
            student_id    INTEGER REFERENCES students(student_id),
            title         TEXT NOT NULL,
            description   TEXT NOT NULL,
            location      TEXT NOT NULL,
            category      TEXT NOT NULL CHECK(category IN ('plumbing','electrical','cleanliness','hardware','security','other')),
            severity      TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
            status        TEXT DEFAULT 'pending' CHECK(status IN ('pending','assigned','in_progress','resolved')),
            image_data    TEXT,
            assigned_role TEXT CHECK(assigned_role IN ('worker','guard')),
            assigned_id   INTEGER,
            assigned_name TEXT,
            reported_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at   TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS security_alerts (
            alert_id    SERIAL PRIMARY KEY,
            alert_type  TEXT NOT NULL,
            location    TEXT NOT NULL,
            description TEXT NOT NULL,
            severity    TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
            is_resolved INTEGER DEFAULT 0,
            reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS guard_schedules (
            schedule_id SERIAL PRIMARY KEY,
            guard_id    INTEGER REFERENCES guards(guard_id),
            shift_start TIMESTAMP NOT NULL,
            shift_end   TIMESTAMP NOT NULL,
            zone        TEXT NOT NULL
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS worker_duties (
            duty_id          SERIAL PRIMARY KEY,
            worker_id        INTEGER REFERENCES workers(worker_id),
            task_description TEXT NOT NULL,
            location         TEXT NOT NULL,
            status           TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed')),
            assigned_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS system_settings (
            setting_key   TEXT PRIMARY KEY,
            setting_value TEXT
        )`);
        
        db.get("SELECT COUNT(*) AS cnt FROM users", (err, row) => {
            if (err || (row && row.cnt > 0)) return;
            // SEED DATA 
            db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", ['System Admin', 'admin@campus.edu', 'Admin@123', 'admin']);
            db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", ['Mehul Krishna', 'student@campus.edu', 'Student@123', 'student']);
            db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", ['Dr. Anjan Prasad', 'faculty@campus.edu', 'Faculty@123', 'faculty']);
            db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", ['Suresh Kumar', 'worker@campus.edu', 'Worker@123', 'worker']);
            db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", ['Kamleshbhai', 'guard@campus.edu', 'Guard@123', 'guard']);
            db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", ['Yuvaraju', 'yuvaraju@campus.edu', 'Yuvaraju@123', 'student']);
            db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", ['Rohith', 'rohith@campus.edu', 'Rohith@123', 'student']);
            db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", ['Abhay', 'abhay@campus.edu', 'Abhay@123', 'guard']);
            
            db.run("INSERT INTO students (name, department, year, program, user_id) VALUES (?, ?, ?, ?, ?)", ['Mehul Krishna', 'Computer Science', 3, 'B.Tech', 2]);
            db.run("INSERT INTO students (name, department, year, program, user_id) VALUES (?, ?, ?, ?, ?)", ['Yuvaraju', 'Electronics', 2, 'B.Tech', 6]);
            db.run("INSERT INTO students (name, department, year, program, user_id) VALUES (?, ?, ?, ?, ?)", ['Rohith', 'Mechanical', 4, 'B.Tech', 7]);
            
            db.run("INSERT INTO faculty (name, department, designation, user_id) VALUES (?, ?, ?, ?)", ['Dr. Anjan Prasad', 'Computer Science', 'Associate Professor', 3]);
            db.run("INSERT INTO workers (name, role_title, user_id) VALUES (?, ?, ?)", ['Suresh Kumar', 'Senior Electrician', 4]);
            db.run("INSERT INTO guards (name, badge_no, user_id) VALUES (?, ?, ?)", ['Kamleshbhai', 'GRD-001', 5]);
            db.run("INSERT INTO guards (name, badge_no, user_id) VALUES (?, ?, ?)", ['Abhay', 'GRD-002', 8]);
            
            db.run("INSERT INTO courses (course_code, course_name, credits, faculty_id) VALUES (?, ?, ?, ?)", ['CS202', 'Software Engineering', 4, 1]);
            db.run("INSERT INTO courses (course_code, course_name, credits, faculty_id) VALUES (?, ?, ?, ?)", ['CS204', 'DBMS', 4, 1]);
            db.run("INSERT INTO courses (course_code, course_name, credits, faculty_id) VALUES (?, ?, ?, ?)", ['CS206', 'System Software', 3, 1]);
            
            db.run("INSERT INTO course_registrations (student_id, course_id) VALUES (?, ?)", [1, 1]);
            db.run("INSERT INTO course_registrations (student_id, course_id) VALUES (?, ?)", [1, 2]);
            
            db.run("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)", ['blueprint', '']);
        });
    });
}

module.exports = db;
