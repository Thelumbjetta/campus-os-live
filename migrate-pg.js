const fs = require('fs');
let code = fs.readFileSync('database.js', 'utf8');

const pgImport = `const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_5sw1GdCBaoAe@ep-purple-bird-amzww2ua-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

function convertQuery(sql) {
    let i=1; 
    let pSql=sql.replace(/\\?/g, () => '$'+(i++)); 
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
  getInternalPool: () => pool
};

pool.connect((err) => {
  if (err) console.error('Error connecting to Neon Postgres:', err);
  else { console.log('Connected to Neon PostgreSQL Database!'); initSchema(); }
});
`;

// Replace sqlite dependency and connection with pg wrapper
code = code.replace(/const sqlite3[\s\S]+?initSchema\(\);\s+?\}/, pgImport);

// 2. Schema conversions
code = code.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY');
code = code.replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/g, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

// 3. Fix the notices schema to include image_data TEXT
code = code.replace(/valid_until TEXT\s*\)/, 'valid_until TEXT,\n              image_data TEXT\n          )');

// 4. Update seed insertion logic 
code = code.replace(/const uStmt = db\.prepare\((.*?)\);/g, 'const uSql = $1;');
code = code.replace(/uStmt\.run\((.*?)\);/g, 'db.run(uSql, [$1]);');
code = code.replace(/uStmt\.finalize\(\);/g, '');

code = code.replace(/const qStmt = db\.prepare\((.*?)\);/g, 'const qSql = $1;');
code = code.replace(/qStmt\.run\((.*?)\);/g, 'db.run(qSql, [$1]);');
code = code.replace(/qStmt\.finalize\(\);/g, '');

code = code.replace(/const sStmt = db\.prepare\((.*?)\);/g, 'const sSql = $1;');
code = code.replace(/sStmt\.run\((.*?)\);/g, 'db.run(sSql, [$1]);');
code = code.replace(/sStmt\.finalize\(\);/g, '');

code = code.replace(/const fStmt = db\.prepare\((.*?)\);/g, 'const fSql = $1;');
code = code.replace(/fStmt\.run\((.*?)\);/g, 'db.run(fSql, [$1]);');
code = code.replace(/fStmt\.finalize\(\);/g, '');

code = code.replace(/const cStmt = db\.prepare\((.*?)\);/g, 'const cSql = $1;');
code = code.replace(/cStmt\.run\((.*?)\);/g, 'db.run(cSql, [$1]);');
code = code.replace(/cStmt\.finalize\(\);/g, '');

code = code.replace(/const pqStmt = db\.prepare\((.*?)\);/g, 'const pqSql = $1;');
code = code.replace(/pqStmt\.run\((.*?)\);/g, 'db.run(pqSql, [$1]);');
code = code.replace(/pqStmt\.finalize\(\);/g, '');

code = code.replace(/const prStmt = db\.prepare\((.*?)\);/g, 'const prSql = $1;');
code = code.replace(/prStmt\.run\((.*?)\);/g, 'db.run(prSql, [$1]);');
code = code.replace(/prStmt\.finalize\(\);/g, '');

code = code.replace(/const setStmt = db\.prepare\((.*?)\);/g, 'const setSql = $1;');
code = code.replace(/setStmt\.run\((.*?)\);/g, 'db.run(setSql, [$1]);');
code = code.replace(/setStmt\.finalize\(\);/g, '');

fs.writeFileSync('database.js', code);
console.log('Database rewritten successfully for Neon Postgres.');
