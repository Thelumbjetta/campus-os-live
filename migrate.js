/**
 * Migration script - run once to apply DB schema changes:
 * 1. Add image_data column to notices
 * 2. Clear all test/user-generated data
 * 3. Seed fresh worker duties + guard schedules
 */
const db = require('./database');

const today = new Date().toISOString().split('T')[0];
const tomorrow = new Date(Date.now()+86400000).toISOString().split('T')[0];
const dayAfter  = new Date(Date.now()+172800000).toISOString().split('T')[0];

setTimeout(() => {
  console.log('\n🔧 Running migrations...\n');

  // 1. Add image_data to notices (safe to re-run)
  db.run(`ALTER TABLE notices ADD COLUMN image_data TEXT`, [], (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('❌ notices.image_data:', err.message);
    } else {
      console.log('✅ notices.image_data column ready');
    }
  });

  // 2. Clear user-generated test data (queries, forum, issues)
  db.run(`DELETE FROM query_replies`, [], () => {
  db.run(`DELETE FROM queries`, [], () => {
  db.run(`DELETE FROM public_queries`, [], () => {
  db.run(`DELETE FROM issue_reports`, [], () => {
    console.log('✅ Cleared all user-generated test data (queries, forum, issues)');
  }); }); }); });

  // 3. Clear and re-seed worker_duties with correct schema
  db.run(`DELETE FROM worker_duties`, [], (err) => {
    if (err) { console.error('worker_duties clear:', err.message); return; }

    const stmt = db.prepare(`INSERT INTO worker_duties (worker_id,shift_date,shift_start,shift_end,task,location,status) VALUES (?,?,?,?,?,?,?)`);
    // Worker 1 — Electrician
    stmt.run(1, today,    '06:00','14:00','Electrical Panel Inspection & Safety Check', 'Block A — Panel Room', 'scheduled');
    stmt.run(1, today,    '14:00','18:00','Generator Backup Test & Fuel Top-up', 'Lab Complex — Generator Bay', 'scheduled');
    stmt.run(1, tomorrow, '07:00','15:00','AC Unit Filter Cleaning (6 Units)', 'Block B — 2nd Floor', 'scheduled');
    stmt.run(1, dayAfter, '06:00','12:00','Main Switchboard Maintenance', 'Admin Block Basement', 'scheduled');
    // Worker 2 — Plumber
    stmt.run(2, today,    '08:00','16:00','Pipeline Leak Repair — D Wing', 'Hostel Block D', 'scheduled');
    stmt.run(2, today,    '16:00','20:00','Water Tank Cleaning & Chlorination', 'Rooftop Water Tank', 'scheduled');
    stmt.run(2, tomorrow, '08:00','14:00','Washroom Plumbing Inspection', 'Block C — All Floors', 'scheduled');
    // Worker 3 — Cleaner
    stmt.run(3, today,    '05:00','13:00','Campus Grounds Sweeping & Waste Collection', 'Full Campus Perimeter', 'completed');
    stmt.run(3, today,    '13:00','17:00','Lecture Hall Deep Clean (LH-101–104)', 'Lecture Hall Block', 'scheduled');
    stmt.run(3, tomorrow, '05:00','11:00','Cafeteria Cleaning & Sanitization', 'Campus Cafeteria', 'scheduled');
    stmt.finalize(() => console.log('✅ Worker duties seeded (10 entries)'));
  });

  // 4. Clear and re-seed guard schedules if empty
  db.get(`SELECT COUNT(*) AS c FROM guard_schedules`, [], (err, row) => {
    if (row?.c > 0) { console.log('✅ Guard schedules already seeded — skipping'); return; }
    const gs = db.prepare(`INSERT INTO guard_schedules (guard_id,shift_date,shift_start,shift_end,duty_area,post_no) VALUES (?,?,?,?,?,?)`);
    gs.run(1, today,    '06:00','14:00','Main Gate & Security Checkpoint','POST-01');
    gs.run(1, today,    '14:00','22:00','Academic Block Perimeter','POST-03');
    gs.run(1, tomorrow, '22:00','06:00','Hostel Perimeter Night Patrol','POST-05');
    gs.run(2, today,    '06:00','14:00','Parking Zone Monitoring','POST-02');
    gs.run(2, tomorrow, '14:00','22:00','Main Gate','POST-01');
    gs.finalize(() => console.log('✅ Guard schedules seeded (5 entries)'));
  });

  // 5. Seed a demo security alert
  db.get(`SELECT COUNT(*) AS c FROM security_alerts`, [], (err, row) => {
    if (row?.c > 0) { console.log('✅ Security alerts exist — skipping'); return; }
    db.run(`INSERT INTO security_alerts(alert_type,location,details,severity) VALUES (?,?,?,?)`,
      ['Suspicious Person', 'Rear Gate (Gate 3)', 'Unknown individual spotted loitering near the rear gate late evening. Asked to leave — did not comply immediately. Situation resolved.', 'medium'],
      () => console.log('✅ Demo security alert seeded'));
  });

  console.log('\n✅ Migrations complete. Restart server.js\n');
}, 2000); // wait for DB to initialise
