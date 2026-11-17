const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const STATUSES=['todo','in_progress','done'];
function createApp({dbPath=':memory:'}={}){
 const db=new DatabaseSync(dbPath);db.exec("CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY,title TEXT NOT NULL,status TEXT NOT NULL,priority TEXT NOT NULL,created_at TEXT NOT NULL)");
 const all=()=>db.prepare('SELECT * FROM tasks ORDER BY id DESC').all();
 const byStatus=db.prepare('SELECT * FROM tasks WHERE status=? ORDER BY id DESC');
 const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   const url=new URL(req.url,'http://localhost');
   if(req.method==='GET'&&['/','/app.js'].includes(url.pathname)){
    const file=url.pathname==='/'?'index.html':'app.js';res.writeHead(200,{'Content-Type':file.endsWith('html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});res.end(fs.readFileSync(path.join(__dirname,'../public',file)));return;
   }
   if(req.method==='GET'&&url.pathname==='/api/tasks'){
    const statuses=url.searchParams.getAll('status');
    if(statuses.length===0)return send(200,all());
    if(statuses.length>1)return send(400,{error:'Parameter status duplikat'});
    const status=statuses[0];
    if(!STATUSES.includes(status))return send(400,{error:'Status tidak valid'});
    return send(200,byStatus.all(status));
   }
   const match=/^\/api\/tasks\/([1-9][0-9]*)$/.exec(url.pathname);
   if(!(req.method==='POST'&&url.pathname==='/api/tasks')&&!(req.method==='PATCH'&&match))return send(404,{error:'Tidak ditemukan'});
   let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>8192){send(413,{error:'Permintaan terlalu besar'});return;}body+=chunk;}
   let data;try{data=JSON.parse(body);}catch{return send(400,{error:'JSON tidak valid'});}if(!data||typeof data!=='object'||Array.isArray(data))return send(400,{error:'Data tidak valid'});
   if(req.method==='POST'){
    const title=typeof data.title==='string'?data.title.trim():'';const priority=data.priority===undefined?'medium':data.priority;
    if(!title||title.length>120)return send(400,{error:'Judul harus 1–120 karakter'});
    if(!['low','medium','high'].includes(priority))return send(400,{error:'Prioritas tidak valid'});
    const id=db.prepare("INSERT INTO tasks(title,status,priority,created_at) VALUES(?,'todo',?,?)").run(title,priority,new Date().toISOString()).lastInsertRowid;
    return send(201,db.prepare('SELECT * FROM tasks WHERE id=?').get(id));
   }
   if(!STATUSES.includes(data.status))return send(400,{error:'Status tidak valid'});
   const id=Number(match[1]);if(!Number.isSafeInteger(id))return send(404,{error:'Tugas tidak ditemukan'});
   const result=db.prepare('UPDATE tasks SET status=? WHERE id=?').run(data.status,id);
   if(!result.changes)return send(404,{error:'Tugas tidak ditemukan'});
   send(200,db.prepare('SELECT * FROM tasks WHERE id=?').get(id));
  }catch{if(!res.headersSent)send(500,{error:'Terjadi kesalahan server'});else res.end();}
 });
 return {server,close:()=>new Promise((resolve,reject)=>server.close(error=>{db.close();error?reject(error):resolve();}))};
}
module.exports={createApp};
if(require.main===module){const app=createApp({dbPath:process.env.DB_PATH||'tasks.sqlite'});app.server.listen(Number(process.env.PORT||24110),process.env.HOST||'127.0.0.1');process.on('SIGTERM',()=>app.close().then(()=>process.exit(0)));}
