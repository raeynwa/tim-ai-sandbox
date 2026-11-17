const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {createApp}=require('../src/taskboard.cjs');
test('AC01-06 API validation, isolation and persistence',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tasks-')),dbPath=path.join(dir,'tasks.sqlite');let app=createApp({dbPath});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let base='http://127.0.0.1:'+app.server.address().port;const call=async(method,url,data)=>{const r=await fetch(base+url,{method,headers:{'content-type':'application/json'},...(data!==undefined?{body:JSON.stringify(data)}:{})});return {status:r.status,data:await r.json()};};try{assert.deepEqual((await call('GET','/api/tasks')).data,[]);for(const title of ['', '   ','x'.repeat(121),null])assert.equal((await call('POST','/api/tasks',{title})).status,400);assert.equal((await call('POST','/api/tasks',{title:'test',priority:'urgent'})).status,400);const task=await call('POST','/api/tasks',{title:'  First  '});assert.equal(task.status,201);assert.equal(task.data.title,'First');assert.equal(task.data.status,'todo');assert.equal(task.data.priority,'medium');assert.ok(!Number.isNaN(Date.parse(task.data.created_at)));for(const priority of ['low','high'])assert.equal((await call('POST','/api/tasks',{title:priority,priority})).status,201);for(const status of ['in_progress','done'])assert.equal((await call('PATCH','/api/tasks/'+task.data.id,{status})).data.status,status);assert.equal((await call('PATCH','/api/tasks/'+task.data.id,{status:'illegal'})).status,400);assert.equal((await call('PATCH','/api/tasks/9999',{status:'done'})).status,404);assert.equal((await call('POST','/api/tasks',{title:'x',padding:'x'.repeat(9000)})).status,413);assert.equal((await call('GET','/api/tasks')).data.length,3);await app.close();app=createApp({dbPath});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;assert.equal((await call('GET','/api/tasks')).data.length,3);assert.equal((await call('GET','/api/tasks')).data.find(x=>x.id===task.data.id).status,'done');}finally{await app.close();fs.rmSync(dir,{recursive:true,force:true});}});
test('AC07 web uses textContent, external script and accessible controls',()=>{const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8'),js=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');assert.match(html,/lang="id"/);assert.match(html,/aria-live="polite"/);assert.match(html,/label for="title"/);assert.match(html,/viewport/);assert.match(js,/title.textContent=task.title/);assert.doesNotMatch(js,/innerHTML/);});

test('TM-7 exact filters, descending ids, errors, ignored queries and PATCH membership',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tm7-'));
  const app=createApp({dbPath:path.join(dir,'tasks.sqlite')});
  try {
    await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
    const base='http://127.0.0.1:'+app.server.address().port;
    const call=async(method,url,data)=>{
      const r=await fetch(base+url,{method,headers:{'content-type':'application/json'},...(data!==undefined?{body:JSON.stringify(data)}:{})});
      assert.match(r.headers.get('content-type')||'',/^application\/json;\s*charset=utf-8$/i);
      assert.equal(r.headers.get('cache-control'),'no-store');
      return {status:r.status,data:await r.json()};
    };
    const get=async(query,expected)=>{const r=await call('GET','/api/tasks'+query);assert.equal(r.status,200,query);assert.deepEqual(r.data,expected,query);};
    await get('',[]);
    for(const status of ['todo','in_progress','done'])await get('?status='+status,[]);
    const tasks=[];
    for(const [i,status] of ['todo','in_progress','done','todo','in_progress','done'].entries()){
      const r=await call('POST','/api/tasks',{title:['Zulu','Alpha','Yankee','Bravo','Xray','Charlie'][i],priority:'high'});
      assert.equal(r.status,201);
      assert.deepEqual(Object.keys(r.data).sort(),['created_at','id','priority','status','title']);
      assert.equal(typeof r.data.id,'number');
      tasks.push(r.data);
      if(status!=='todo'){
        const updated=await call('PATCH','/api/tasks/'+r.data.id,{status});
        assert.equal(updated.status,200);assert.equal(updated.data.status,status);
        tasks[i]={...r.data,status};
      }
    }
    const all=()=>[...tasks].sort((a,b)=>b.id-a.id);
    const subset=status=>all().filter(t=>t.status===status);
    await get('',all());
    for(const status of ['todo','in_progress','done'])await get('?status='+status,subset(status));
    await get('?status=%74odo',subset('todo'));
    for(const query of ['?foo=bar','?status[]=todo','?Status=done'])await get(query,all());
    await get('?foo=bar&status=in_progress',subset('in_progress'));
    for(const query of ['?status=','?status','?status=TODO','?status=Done','?status=null','?status=all','?status=%20todo','?status=todo+','?status=todo,done','?status=todo%7Cdone',"?status=%27%20OR%201%3D1--",'?status=todo&status=todo','?status=todo&status=done']){
      const r=await call('GET','/api/tasks'+query);
      assert.equal(r.status,400,query);
      assert.deepEqual(Object.keys(r.data),['error']);
      // Contract permits a dedicated duplicate-parameter error; all other invalid values share PATCH's message.
      assert.equal(r.data.error,query.includes('&status=')?'Parameter status duplikat':'Status tidak valid',query);
    }
    await get('',all());
    for(const task of tasks.filter(t=>t.status==='todo')){
      const r=await call('PATCH','/api/tasks/'+task.id,{status:'done'});
      assert.equal(r.status,200);assert.equal(r.data.status,'done');task.status='done';
    }
    await get('?status=todo',[]);
    await get('?status=done',subset('done'));
    await get('?status=in_progress',subset('in_progress'));
    await get('',all());
  } finally {await app.close();fs.rmSync(dir,{recursive:true,force:true});}
});
