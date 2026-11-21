'use strict';
/* サンプルJSON と画面状態の相互変換。通信処理なし。 */
(function(g){
 const ids=['slot1','slot2','slot3'];
 const sourceObj=o=>o&&typeof o==='object'&&!Array.isArray(o)?o:{};
 const sortedValues=(node,sort='order')=>Object.values(sourceObj(node)).sort((a,b)=>(Number(a?.[sort])||0)-(Number(b?.[sort])||0));
 const sections=blob=>{
   const result={};
   for(const [id,entries] of Object.entries(sourceObj(blob))){
     result[id]=sortedValues(entries).map(e=>({section:String(e.section??''),lyrics:String(e.lyrics??''),note:''}));
   }
   return result;
 };
 const songs=blob=>Object.entries(sourceObj(blob)).map(([id,x])=>({id,title:String(x?.title??''),tuning:String(x?.tuning??''),capo:x?.capo??null,durationSeconds:Number(x?.durationSeconds||0),bpm:x?.bpm??null,driveFolderUrl:String(x?.driveFolderUrl||'')})).sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
 const songNotes=(data, details)=>{
   const out={};
   for(const [songId, block] of Object.entries(sourceObj(data))){
     const sorted=Object.entries(sourceObj(block?.columns)).sort((a,b)=>Number(a[1]?.order||0)-Number(b[1]?.order||0));
     const columnIds=sorted.map(([key])=>key);
     const columns=sorted.map(([,x])=>String(x?.title||'追記メモ'));
     const descriptions=Object.fromEntries(sorted.map(([id,x])=>[id,String(x?.description||'')]));
     const overalls=Object.fromEntries(sorted.map(([id,x])=>[id,String(x?.overall||'')]));
     const filenames=Object.fromEntries(sorted.map(([id,x])=>[id,String(x?.filename||'')]));
     const cells={};
     const n=details[songId]?.length||0;
     for(let i=0;i<n;i++){
       const cell=sourceObj(block?.cells?.[`s${String(i+1).padStart(2,'0')}`]);
       const vals=columnIds.map(col=>typeof cell[col]==='string'?cell[col]:'');
       if(vals.some(v=>v))cells[i]=vals;
     }
     const reviews={};for(const id of columnIds){const node=sourceObj(block?.reviews?.[id]),rows={};for(const [key,value] of Object.entries(node)){const match=/^s(\d+)$/.exec(key);if(match&&typeof value==='string')rows[Number(match[1])-1]=value;}reviews[id]=rows;}
     out[songId]={columns,columnIds,cells,descriptions,overalls,filenames,reviews,noColumns:block?.noColumns===true};
   }
   return out;
 };
 const taskArray=blob=>Object.entries(sourceObj(blob)).map(([id,t])=>({...sourceObj(t),id}));
 const slotArray=(blob,type)=>ids.map((id,i)=>{
   const row=sourceObj(blob?.[id]);
   const entries=Object.entries(sourceObj(row.entries)).map(([key,e])=>({id:key,...sourceObj(e)})).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||a.id.localeCompare(b.id));
   const basic={name:String(row.name??`${type==='practice'?'練習':'セトリ'} ${i+1}`),minutes:Number.isInteger(row.minutes)?row.minutes:(type==='practice'?120:30),entries};
   return type==='practice'?{...basic,startTime:String(row.startTime||'18:00'),endTime:String(row.endTime||'20:00')}:basic;
 });
 const newSchedules=blob=>Object.entries(sourceObj(blob)).map(([id,x])=>({id,...sourceObj(x)}));
 const newMeetings=blob=>Object.entries(sourceObj(blob)).map(([id,x])=>({...sourceObj(x),id,rows:Object.entries(sourceObj(x.rows)).map(([key,row])=>({id:key,...sourceObj(row)})).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0))})).sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0));
 const convert=(root)=>{
   const data=sourceObj(root),detailMap=sections(data.songSections);
   return {songs:songs(data.songs),details:detailMap,extras:songs(data.setlistExtras),practice: Object.entries(sourceObj(data.practicePresets)).map(([id,x])=>({id,title:String(x.title),minutes:Number(x.minutes)})),state:{
       version:11,tasks:taskArray(data.tasks),accounting:Object.entries(sourceObj(data.accounting)).map(([id,x])=>({id,...sourceObj(x)})),detailEdits:songNotes(data.songNotes,detailMap),schedules:newSchedules(data.schedules),availability:sourceObj(data.availability),meetings:newMeetings(data.meetings),
       setlistSlots:slotArray(data.setlistSlots,'setlist'),practiceSlots:slotArray(data.practiceSlots,'practice')
     }};
 };
 const diff=(previous,next)=>{
   const changes=[]; // {path, value}; value=null means delete
   const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
   const put=(path,value)=>{
     if(path.split('/').some(component=>/^[.#$\[\]]/.test(component)||/[.#$\[\]\/]/.test(component)))throw Error('書き込み先に不正なキーが含まれています');
     changes.push({path,value});
   };
   const byId=arr=>Object.fromEntries((arr||[]).map(x=>[x.id,x]));
   function compareChildren(base,oldMap,newMap,strip=[]){
     for(const key of new Set([...Object.keys(oldMap),...Object.keys(newMap)])){
       const o=oldMap[key],n=newMap[key],path=`${base}/${key}`;
       if(!n){put(path,null);continue;}
       if(!o){put(path,n);continue;}
       const keys=new Set([...Object.keys(o),...Object.keys(n)]);
       for(const field of keys){if(strip.includes(field))continue;if(!equal(o[field],n[field]))put(`${path}/${field}`,n[field]===undefined?null:n[field]);}
     }
   }
   compareChildren('tasks',byId(previous.tasks),byId(next.tasks));
   compareChildren('schedules',byId(previous.schedules),byId(next.schedules));
   // 新規議題は本文行を含む1つのノードとして書き込む。親子への同時setで行が消える競合を防ぐ。
   const priorMeetings=byId(previous.meetings),nextMeetings=byId(next.meetings);
   for(const id of new Set([...Object.keys(priorMeetings),...Object.keys(nextMeetings)])){
     const old=priorMeetings[id],neu=nextMeetings[id],base=`meetings/${id}`;
     const ordered=rows=>byId((rows||[]).map((r,i)=>({text:r.text,order:i,id:r.id})));
     if(!neu){put(base,null);continue;}
     if(!old){put(base,{title:neu.title,createdAt:neu.createdAt,rows:ordered(neu.rows)});continue;}
     for(const field of ['title','createdAt'])if(!equal(old[field],neu[field]))put(`${base}/${field}`,neu[field]??null);
     compareChildren(`${base}/rows`,ordered(old.rows),ordered(neu.rows));
   }
   for(const day of new Set([...Object.keys(previous.availability||{}),...Object.keys(next.availability||{})])){
     const o=previous.availability?.[day]||{},n=next.availability?.[day]||{};
     for(const member of new Set([...Object.keys(o),...Object.keys(n)])){
       if(!equal(o[member],n[member]))put(`availability/${day}/${member}`,n[member]||null);
     }
   }
   for(const kind of ['practice','setlist']){
     const key=kind+'Slots';
     for(let i=0;i<3;i++){
       const o=previous[key]?.[i]||{},n=next[key]?.[i]||{},base=`${key}/slot${i+1}`;
       for(const f of kind==='practice'?['name','minutes','startTime','endTime']:['name','minutes']){
         if(!equal(o[f],n[f]))put(`${base}/${f}`,n[f]);
       }
       const withOrder=(xs)=>byId((xs||[]).map((e,i)=>({...e,order:i})));
       compareChildren(`${base}/entries`,withOrder(o.entries),withOrder(n.entries));
     }
   }
   // 追記欄：列を一意のIDで保持し、異なるセルの変更が衝突しないようにする。
   for(const songId of new Set([...Object.keys(previous.detailEdits||{}),...Object.keys(next.detailEdits||{})])){
     const o=previous.detailEdits?.[songId]||{columns:[],columnIds:[],cells:{}};
     const n=next.detailEdits?.[songId]||{columns:[],columnIds:[],cells:{}};
     const cols=entry=>Object.fromEntries((entry.columnIds||[]).map((id,i)=>[id,{title:entry.columns[i],description:entry.descriptions?.[id]||'',order:i}]));
     if((o.columnIds||[]).length===0 !== ((n.columnIds||[]).length===0))put(`songNotes/${songId}/noColumns`,(n.columnIds||[]).length===0?true:null);
     compareChildren(`songNotes/${songId}/columns`,cols(o),cols(n));
     const rowKey=i=>`s${String(Number(i)+1).padStart(2,'0')}`;
     const cellValues=entry=>{
       const out={};for(const [row,values] of Object.entries(entry.cells||{})){
         for(let i=0;i<(entry.columnIds||[]).length;i++){
           const colId=entry.columnIds[i],content=values[i]||'';
           if(content)out[`${rowKey(row)}/${colId}`]=content;
         }
       }return out;
     };
     const reviews=entry=>{const result={};for(const [id,rows] of Object.entries(entry.reviews||{}))for(const [idx,value] of Object.entries(rows||{}))if(value)result[`${id}/s${String(Number(idx)+1).padStart(2,'0')}`]=value;return result;};
     const ro=reviews(o),rn=reviews(n);
     for(const key of new Set([...Object.keys(ro),...Object.keys(rn)]))if(!equal(ro[key],rn[key]))put(`songNotes/${songId}/reviews/${key}`,rn[key]??null);
    const a=cellValues(o),b=cellValues(n);
     for(const key of new Set([...Object.keys(a),...Object.keys(b)]))if(!equal(a[key],b[key]))put(`songNotes/${songId}/cells/${key}`,b[key]??null);
   }
   return changes;
 };
 g.KoryoCloudModel={convert,sections,songs,songNotes,taskArray,slotArray,diff};
})(window);
