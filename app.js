'use strict';
/* さいわいさん：持ち曲は固定、練習タイテとセトリを各3スロットに自動保存。 */
(() => {
  const PREFS_KEY='saiwaisan.test.preferences.v1';
  const $app=document.getElementById('app');
  const $modal=document.getElementById('modal-root');
  const $toast=document.getElementById('toast');
  const SLOTS=3;
  const TASK_CATEGORIES=['🎸【アレンジ】','✒️【作業】'];
  const TASK_STATUSES=['進行中','レビュー依頼','保留','完了'];
  const TASK_MEMBERS=['🟢','🔵','🟠'];
  const localDate=()=>{const d=new Date();const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
  const icons={
    songs:'<path d="m9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2.5"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
    metronome:'<path d="M4 21h16M9 21l5-17M8 7h2M15 8l4 3"/>',
    score:'<path d="M3 5h18M3 9h18M3 13h18M3 17h18M3 21h18"/><path d="M14 13v-9l6-2v10"/><ellipse cx="12" cy="14" rx="2.6" ry="1.7" fill="currentColor" stroke="none"/><ellipse cx="18" cy="13" rx="2.6" ry="1.7" fill="currentColor" stroke="none"/>',
    back:'<path d="m15 18-6-6 6-6"/>',
    archive:'<path d="M3 5h18v5H3zM5 10v11h14V10M10 14h4"/>',
    edit:'<path d="m4 16-.5 4.5L8 20l11-11-3.5-3.5L4 16Zm9-9 3.5 3.5"/>',
    rename:'<path d="m4 16-.5 4.5L8 20l11-11-3.5-3.5L4 16Zm9-9 3.5 3.5"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    chevron:'<path d="m9 6 6 6-6 6"/>',
    tasks:'<path d="M3 6l2.5 2.5L9 4M12 6h9M3 15l2.5 2.5L9 13M12 15h9"/>',
    eye:'<path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff:'<path d="M3 3l18 18M10.6 6.2A11 11 0 0 1 12 6c6.3 0 10 6 10 6a13 13 0 0 1-3.2 3.7M6 6.5A13 13 0 0 0 2 12s3.7 6 10 6c1.7 0 3.3-.4 4.6-1.1"/>',
    logout:'<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 17l5-5-5-5M21 12H9"/>',
    trash:'<path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    wallet:'<path d="M3 7h18v13H3zM3 7V5a2 2 0 0 1 2-2h14"/><path d="M16 12h5v5h-5a2.5 2.5 0 0 1 0-5Z"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'
  };
  const ico=(name)=>`<svg viewBox="0 0 24 24" class="icon" aria-hidden="true" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=o=>JSON.parse(JSON.stringify(o));
  const guid=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  const time=s=>`${s<0?'−':''}${Math.floor(Math.abs(s)/60)}:${String(Math.abs(s)%60).padStart(2,'0')}`;
  const pad=n=>String(n).padStart(2,'0');
  const minutesOf=clock=>{const m=/^(\d{2}):(\d{2})$/.exec(clock||'');if(!m)return null;const h=Number(m[1]),n=Number(m[2]);return h<24&&n<60?h*60+n:null;};
  const clockOf=mins=>`${pad(Math.floor(((mins%1440)+1440)%1440/60))}:${pad(((mins%1440)+1440)%1440%60)}`;
  const practiceSpan=s=>{const start=minutesOf(s.startTime),end=minutesOf(s.endTime);if(start===null||end===null)return s.minutes;return (end-start+1440)%1440;};
  const capoText=s=>s.capo==null?'—':String(s.capo);
  const tuneOrder=t=>{const i=KORYOSAN_TUNINGS.indexOf(t);return i<0?999:i;};
  const naturalCompare=(a,b)=>a.localeCompare(b,'ja',{numeric:true,sensitivity:'base'});
  const byCapo=(a,b)=>(a.capo??0)-(b.capo??0)||naturalCompare(a.title,b.title);
  const byDuration=(a,b)=>a.durationSeconds-b.durationSeconds||byCapo(a,b);
  const sorters={capo:byCapo,duration:byDuration};
  const songById=new Map([...KORYOSAN_SONGS,...KORYOSAN_EXTRA].map(song=>[song.id,song]));
  const practiceById=new Map(KORYOSAN_PRACTICE.map(item=>[item.id,item]));
  const newSetlist=i=>({name:`セトリ ${i+1}`,minutes:30,entries:[]});
  const newPractice=i=>({name:`練習 ${i+1}`,minutes:120,startTime:'18:00',endTime:'20:00',entries:[]});
  const makeState=()=>({version:11,detailEdits:{},sort:'capo',taskSort:'deadline',showCompleted:true,showPastSchedules:true,activeSetlist:0,activePractice:0,tasks:[],schedules:[],availability:{},meetings:[],accounting:[],
    setlistSlots:Array.from({length:SLOTS},(_,i)=>newSetlist(i)),
    practiceSlots:Array.from({length:SLOTS},(_,i)=>newPractice(i))});
  function validate(raw){
    if(!raw||typeof raw!=='object')throw Error('保存データの形式が正しくありません');
    const defaults=makeState();
    const validSlot=(s,fallback,isPractice)=>{
      if(!s||typeof s!=='object')return clone(fallback);
      const name=typeof s.name==='string' ? s.name.slice(0,80) : fallback.name;
      const minutes=Number.isInteger(s.minutes)&&s.minutes>=0&&s.minutes<=999?s.minutes:fallback.minutes;
      const entries=Array.isArray(s.entries)?s.entries.slice(0,300).map(entry=>{
        const id=typeof entry?.id==='string'?entry.id.slice(0,90):guid();
        if(isPractice){
          if(!practiceById.has(entry?.presetId))return null;
          const n=entry.minutes;
          return {id,presetId:entry.presetId,minutes:Number.isInteger(n)&&n>=5&&n<=240&&n%5===0?n:practiceById.get(entry.presetId).minutes,
            note:typeof entry.note==='string'?entry.note.slice(0,3000):''};
        }
        return songById.has(entry?.songId)?{id,songId:entry.songId}:null;
      }).filter(Boolean):[];
      if(!isPractice)return {name,minutes,entries};
      const startTime=minutesOf(s.startTime)!==null?s.startTime:fallback.startTime;
      const endTime=minutesOf(s.endTime)!==null?s.endTime:clockOf(minutesOf(startTime)+minutes);
      return {name,minutes,startTime,endTime,entries};
    };
    const tasks=Array.isArray(raw.tasks) ? raw.tasks.slice(0,2000).filter(t=>t&&typeof t==='object').map(t=>({
      id:typeof t.id==='string'?t.id.slice(0,100):guid(),
      category:TASK_CATEGORIES.includes(t.category)?t.category:'',
      name:typeof t.name==='string'?t.name.slice(0,200):'',
      status:TASK_STATUSES.includes(t.status)?t.status:'',
      deadline:typeof t.deadline==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(t.deadline)?t.deadline:localDate(),
      members:Array.isArray(t.members)?TASK_MEMBERS.filter(m=>t.members.includes(m)):[],
      notes:typeof t.notes==='string'?t.notes.slice(0,4000):'',
      place:typeof t.place==='string'?t.place.slice(0,400):'',
      createdAt:Number.isFinite(t.createdAt)?t.createdAt:0
    })):[];
    // 1・2列目は固定。3列目以降だけ、曲ごとのテキストとして端末に保存する。
    const detailEdits={};
    if(raw.detailEdits && typeof raw.detailEdits==='object' && !Array.isArray(raw.detailEdits)){
      for(const [songId,entry] of Object.entries(raw.detailEdits)){
        const sections=KORYOSAN_DETAILS?.[songId];
        if(!sections?.length || !entry || typeof entry!=='object')continue;
        const headers=Array.isArray(entry.columns) ? entry.columns.slice(0,14).map((v,i)=>typeof v==='string'?v.slice(0,30):`追記メモ ${i+1}`) : [];
        const cells={};
        if(entry.cells && typeof entry.cells==='object' && !Array.isArray(entry.cells)){
          for(const [index,values] of Object.entries(entry.cells)){
            const row=Number(index);
            if(!Number.isInteger(row)||row<0||row>=sections.length||!Array.isArray(values))continue;
            cells[row]=values.slice(0,headers.length).map(value=>typeof value==='string'?value.slice(0,5000):'');
          }
        }
        const columnIds=Array.isArray(entry.columnIds)&&entry.columnIds.length===headers.length&&entry.columnIds.every(v=>typeof v==='string'&&/^[A-Za-z0-9_-]+$/.test(v)) ? entry.columnIds.slice() : headers.map((_,i)=>`memo${i+1}`);
        const descriptions=columnIds.map((id,i)=>typeof entry.descriptions?.[id]==='string'?entry.descriptions[id].slice(0,2000):typeof entry.descriptions?.[i]==='string'?entry.descriptions[i].slice(0,2000):'');
        const overalls=columnIds.map(id=>typeof entry.overalls?.[id]==='string'?entry.overalls[id].slice(0,5000):'');
        const filenames=columnIds.map(id=>typeof entry.filenames?.[id]==='string'?entry.filenames[id].slice(0,180):'');
        const reviews={};for(const id of columnIds){const source=entry.reviews?.[id]||{};const rows={};for(const [row,val] of Object.entries(source)){if(/^\d+$/.test(row)&&Number(row)<sections.length&&typeof val==='string')rows[row]=val.slice(0,3000);}reviews[id]=rows;}
        detailEdits[songId]={columns:headers,columnIds,cells,descriptions:Object.fromEntries(columnIds.map((id,i)=>[id,descriptions[i]])),overalls:Object.fromEntries(columnIds.map((id,i)=>[id,overalls[i]])),filenames:Object.fromEntries(columnIds.map((id,i)=>[id,filenames[i]])),reviews,noColumns:headers.length===0};
      }
    }
    // v3で3列目に追記済みの内容と、2列目に置かれていた固定コメントを両方残す。
    if((raw.version??3)<4){
      for(const [songId,entry] of Object.entries(detailEdits)){
        const sections=KORYOSAN_DETAILS?.[songId]||[];
        for(const [index,section] of sections.entries()){
          if(!section.note)continue;
          const row=entry.cells[index]||[];
          const previous=typeof row[0]==='string'?row[0]:'';
          row[0]=previous.includes(section.note)?previous:section.note+(previous?'\n\n'+previous:'');
          entry.cells[index]=row;
        }
      }
    }
    const schedules=(Array.isArray(raw.schedules)?raw.schedules:[]).slice(0,2000).filter(Boolean).map(s=>({
      id:typeof s.id==='string'?s.id.slice(0,100):guid(),category:['practice','live','other'].includes(s.category)?s.category:'',
      date:/^\d{4}-\d{2}-\d{2}$/.test(s.date||'')?s.date:localDate(),
      start:minutesOf(s.start)!==null&&minutesOf(s.start)%5===0?s.start:'',end:minutesOf(s.end)!==null&&minutesOf(s.end)%5===0?s.end:'',
      place:typeof s.place==='string'?s.place.slice(0,400):'',notes:typeof s.notes==='string'?s.notes.slice(0,5000):'',createdAt:Number.isFinite(s.createdAt)?s.createdAt:0
    }));
    const availability={};for(const [day,vals] of Object.entries(raw.availability||{})){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!vals||typeof vals!=='object')continue;
      const block={};for(const member of TASK_MEMBERS)if(typeof vals[member]==='string'&&vals[member])block[member]=vals[member].slice(0,400);
      if(Object.keys(block).length)availability[day]=block;
    }
    const meetings=(Array.isArray(raw.meetings)?raw.meetings:[]).slice(0,1000).filter(Boolean).map(m=>({
      id:typeof m.id==='string'?m.id.slice(0,100):guid(),title:typeof m.title==='string'?m.title.slice(0,300):'',
      createdAt:Number.isFinite(m.createdAt)?m.createdAt:0,
      rows:(Array.isArray(m.rows)?m.rows:[]).slice(0,200).map(r=>({id:typeof r?.id==='string'?r.id.slice(0,100):guid(),text:typeof r?.text==='string'?r.text.slice(0,10000):''}))
    }));
    const accounting=(Array.isArray(raw.accounting)?raw.accounting:[]).slice(0,3000).filter(x=>x&&typeof x==='object').map(x=>({
      id:typeof x.id==='string'?x.id.slice(0,100):guid(),type:['income','expense'].includes(x.type)?x.type:'',
      date:typeof x.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)?x.date:localDate(),
      member:TASK_MEMBERS.includes(x.member)?x.member:'',item:typeof x.item==='string'?x.item.slice(0,300):'',
      amount:(x.amount===''||x.amount==null)?'':Number.isSafeInteger(Number(x.amount))&&Number(x.amount)>=0?String(Number(x.amount)):'',
      notes:typeof x.notes==='string'?x.notes.slice(0,5000):'',createdAt:Number.isFinite(x.createdAt)?x.createdAt:0
    }));
    return {version:11,detailEdits,tasks,schedules,availability,meetings,accounting,taskSort:['deadline',...TASK_MEMBERS].includes(raw.taskSort)?raw.taskSort:'deadline',showCompleted:raw.showCompleted!==false,showPastSchedules:raw.showPastSchedules!==false,sort:['capo','duration'].includes(raw.sort)?raw.sort:'capo',
      activeSetlist:[0,1,2].includes(raw.activeSetlist)?raw.activeSetlist:0,
      activePractice:[0,1,2].includes(raw.activePractice)?raw.activePractice:0,
      setlistSlots:defaults.setlistSlots.map((s,i)=>validSlot(raw.setlistSlots?.[i],s,false)),
      practiceSlots:defaults.practiceSlots.map((s,i)=>validSlot(raw.practiceSlots?.[i],s,true))};
  }
  function read(){
    // 認証前の公開用データや端末の旧版保存データを復元しない。
    const data=validate(window.__SAIWAI_LOCAL_STATE||window.__KORYO_INITIAL_STATE||makeState());
    try {const prefs=JSON.parse(localStorage.getItem(PREFS_KEY)||'{}');
      data.sort=['capo','duration'].includes(prefs.sort)?prefs.sort:'capo';
      data.taskSort=['deadline',...TASK_MEMBERS].includes(prefs.taskSort)?prefs.taskSort:'deadline';data.showCompleted=prefs.showCompleted!==false;data.showPastSchedules=prefs.showPastSchedules!==false;
      data.activeSetlist=[0,1,2].includes(prefs.activeSetlist)?prefs.activeSetlist:0;
      data.activePractice=[0,1,2].includes(prefs.activePractice)?prefs.activePractice:0;
    }catch(_){}
    // 旧版の保存データは自動削除しない。バックアップ後にユーザーの明示操作で削除。
    return data;
  }
  let state=read(), page='tasks', detailSong=null, modalOpen=false, taskEditingId=null, dragging=null, availabilityRange=null, accountingFilter='all',searchQuery='';
  const meetingCollapsed=new Set(state.meetings.map(m=>m.id));
  const scrollPos={task:0,song:0,detail:0,detailX:0,practiceDraft:0,practiceLibrary:0,setDraft:0,setLibrary:0,schedule:0,meeting:0,accounting:0,search:0};
  const DATA_KEY='saiwaisan.test.data.v1';
  let saveTimer=null;
  function persistPrefs(){
    try{localStorage.setItem(PREFS_KEY,JSON.stringify({sort:state.sort,taskSort:state.taskSort,showCompleted:state.showCompleted,showPastSchedules:state.showPastSchedules,activeSetlist:state.activeSetlist,activePractice:state.activePractice}));}catch(error){console.warn(error);}
  }
  function commitLocal(){if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}try{localStorage.setItem(DATA_KEY,JSON.stringify(state));persistPrefs();}catch(error){console.error(error);toast('保存できませんでした。ストレージ容量をご確認ください');}}
  function save(){clearTimeout(saveTimer);saveTimer=setTimeout(commitLocal,600);}
  function saveDebounced(){save();}
  function syncError(message){toast(message);}
  window.SaiwaiSanTest={save:commitLocal};
  window.addEventListener('pagehide',commitLocal);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')commitLocal();});
  function flushRemote(){}
  let toastTimer;
  function toast(message){$toast.textContent=message;$toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$toast.classList.remove('show'),3000);}
  function slot(kind){return kind==='setlist'?state.setlistSlots[state.activeSetlist]:state.practiceSlots[state.activePractice];}
  function sum(kind){return slot(kind).entries.reduce((n,e)=>n+(kind==='practice'?e.minutes:(songById.get(e.songId)?.durationSeconds||0)),0);}
  function groupedSongs(sortMode){return KORYOSAN_TUNINGS.map(t=>({tuning:t,songs:KORYOSAN_SONGS.filter(s=>s.tuning===t).slice().sort(sorters[sortMode]||byCapo)}));}
  function storeScroll(){for(const [key,el] of Object.entries({task:document.querySelector('[data-scroll="task"]'),detail:document.querySelector('[data-scroll="detail"]'),song:document.querySelector('[data-scroll="song"]'),practiceDraft:document.querySelector('[data-scroll="practiceDraft"]'),practiceLibrary:document.querySelector('[data-scroll="practiceLibrary"]'),setDraft:document.querySelector('[data-scroll="setDraft"]'),setLibrary:document.querySelector('[data-scroll="setLibrary"]'),schedule:document.querySelector('[data-scroll="schedule"]'),meeting:document.querySelector('[data-scroll="meeting"]'),accounting:document.querySelector('[data-scroll="accounting"]'),search:document.querySelector('[data-scroll="search"]')}))if(el)scrollPos[key]=el.scrollTop;
    const table=document.querySelector('.detail-lyrics-wrap');if(table)scrollPos.detailX=table.scrollLeft;
  }
  function restoreScroll(){Object.keys(scrollPos).forEach(key=>{const el=document.querySelector(`[data-scroll="${key}"]`);if(el)el.scrollTop=scrollPos[key];});
    const table=document.querySelector('.detail-lyrics-wrap');if(table)table.scrollLeft=scrollPos.detailX;
  }
  function slotButtons(kind){
    const arr=kind==='practice'?state.practiceSlots:state.setlistSlots,active=kind==='practice'?state.activePractice:state.activeSetlist;
    return `<div class="header-slotbar" role="group" aria-label="${kind==='practice'?'練習タイテ':'セトリ'}のスロット">${arr.map((s,i)=>`<div class="header-slot ${i===active?'active':''}">
      <button type="button" class="slot-button" data-action="slot" data-kind="${kind}" data-index="${i}" aria-pressed="${i===active}" aria-label="${esc(s.name)}・スロット${i+1}"><strong>${esc(s.name)}</strong></button>
      <button type="button" class="slot-rename" data-action="slot-rename" data-kind="${kind}" data-index="${i}" aria-label="${esc(s.name)}の名前を変更" title="名前を変更">${ico('rename')}</button>
    </div>`).join('')}</div>`;
  }
  function header(){
    if(page==='practice'||page==='setlist')return `<header class="app-header app-header-slots">${slotButtons(page)}</header>`;
    let title='曲リスト',left='',right='';
    if(page==='tasks'){
      title='タスク';
      right=`<button class="top-tool" data-action="task-toggle-completed" aria-pressed="${state.showCompleted}" aria-label="完了タスクを${state.showCompleted?'非表示':'表示'}" title="完了タスクを${state.showCompleted?'非表示':'表示'}">${ico(state.showCompleted?'eye':'eyeOff')}</button><button class="top-tool" data-action="task-add" aria-label="タスクを追加" title="タスクを追加">${ico('plus')}</button>`;
    } else if(page==='schedule'){
      title='スケジュール';right=`<button class="top-tool" data-action="schedule-toggle-past" title="過去の予定を${state.showPastSchedules?'隠す':'表示'}" aria-label="過去の予定を${state.showPastSchedules?'隠す':'表示'}">${ico(state.showPastSchedules?'eye':'eyeOff')}</button><button class="top-tool" data-action="schedule-add" title="予定を追加" aria-label="予定を追加">${ico('plus')}</button>`;
    } else if(page==='availability'){
      title='空き日程';right=`<button class="top-today" data-action="availability-today">今日</button>`;
    } else if(page==='meeting'){
      title='会議';right=`<button class="top-tool" data-action="meeting-toggle-all" title="すべて開閉" aria-label="全議題を開閉">${ico('chevron')}</button><button class="top-tool" data-action="meeting-add" title="議題を追加" aria-label="議題を追加">${ico('plus')}</button>`;
    } else if(page==='accounting')title='会計';
    else if(page==='search'){title='検索';right=`<button class="top-tool" data-action="data" title="バックアップ・サンプルを復元" aria-label="データ管理">${ico('archive')}</button>`;}
    else if(page==='detail'){
      title='曲詳細';left=`<button data-action="detail-back" class="nav-back" aria-label="曲リストへ戻る">${ico('back')}</button>`;
    } else if(page==='metronome')title='メトロノーム';
    else right='';
    return `<header class="app-header"><div class="header-left">${left}</div><div class="header-title">${esc(title)}</div><div class="header-right">${right}</div></header>`;
  }
  function tabs(){return `<nav class="tabbar" aria-label="画面切り替え">${[
    ['tasks','tasks','タスク'],['songs','songs','曲リスト'],['schedule','clock','スケジュール'],
    ['metronome','metronome','メトロノーム'],['practice','clock','練習タイテ'],['setlist','list','セトリ作成'],
    ['meeting','edit','会議'],['accounting','wallet','会計'],['availability','tasks','空き日程'],['search','search','検索']
  ].map(([key,iconName,name])=>`<button class="tab ${page===key||(key==='songs'&&page==='detail')?'active':''}" data-action="tab" data-page="${key}" ${page===key?'aria-current="page"':''}>${ico(iconName)}<span>${name}</span></button>`).join('')}</nav>`;}
  function songTable(songs,flat=false){return `<div class="song-rows">${songs.map(song=>`<div class="song-row ${flat?'flat':''}" data-song-row="${esc(song.id)}">
    <span class="song-title">${esc(song.title)}</span>${flat?`<span class="song-tuning">${esc(song.tuning)}</span>`:''}<span class="song-data">${capoText(song)}</span>
    <span class="song-data">${time(song.durationSeconds)}</span><span class="song-data">${song.bpm}</span>
    <button class="score-btn" data-action="detail" data-song="${song.id}" title="${esc(song.title)}の詳細" aria-label="${esc(song.title)}の詳細を見る">${ico('score')}<span>詳細</span></button></div>`).join('')}</div>`;}
  function songsPage(){
    const list=KORYOSAN_SONGS.slice().sort(sorters[state.sort]||byCapo);
    return `<main class="page-scroll songs-page" data-scroll="song"><div class="compact-page-heading"><h1>曲リスト</h1></div>
      <div class="sortbar"><div class="sortgroup" role="group" aria-label="並び替え">${[['capo','Capo順'],['duration','演奏時間順']].map(([k,t])=>`<button data-action="sort" data-sort="${k}" class="${state.sort===k?'selected':''}" aria-pressed="${state.sort===k}">${t}</button>`).join('')}</div></div>
      <div class="table-labels"><span>曲名</span><span>Capo</span><span>演奏時間</span><span>BPM</span><span>詳細</span></div>${songTable(list)}</main>`;
  }
  function detailData(songId){
    const saved=state.detailEdits[songId]||{columns:[],columnIds:[],cells:{},descriptions:{},overalls:{},filenames:{},reviews:{},noColumns:true};
    const sections=KORYOSAN_DETAILS?.[songId]||[];
    const cells={};
    for(const [i,row] of sections.entries()){
      const values=Array.isArray(saved.cells?.[i])?[...saved.cells[i]]:[];
      // v3以前の固定コメントを3列目に移し、編集した内容（空欄含む）を優先。
      if(!Object.prototype.hasOwnProperty.call(values,0)&&row.note)values[0]=row.note;
      cells[i]=values;
    }
    return {columns:[...saved.columns],columnIds:[...(saved.columnIds||saved.columns.map((_,i)=>`memo${i+1}`))],cells,descriptions:{...(saved.descriptions||{})},overalls:{...(saved.overalls||{})},filenames:{...(saved.filenames||{})},reviews:clone(saved.reviews||{}),noColumns:!!saved.noColumns};
  }
  function driveFileId(text){const url=safeLinkedUrl(text);if(!url)return '';try{const u=new URL(url);if(u.hostname!=='drive.google.com')return '';const id=u.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1]||u.searchParams.get('id')||'';return /^[\w-]{15,}$/.test(id)?id:'';}catch(_){return '';}}
  function safeLinkedUrl(text){const m=String(text||'').match(/https?:\/\/[^\s<>"']+/i);if(!m)return '';try{const u=new URL(m[0]);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch(_){return '';}}
  function audioWidget(text,id,filename){const fileId=driveFileId(text);if(!fileId)return '';
    return `<div class="drive-audio"><input type="text" class="drive-file-name" data-detail-filename="${esc(id)}" value="${esc(filename||'')}" maxlength="180" aria-label="音声のファイル名"><button type="button" data-action="audio-preview" class="drive-preview-toggle">Driveで再生</button><div class="drive-iframe-holder" hidden><iframe title="Google Drive音声プレビュー" data-preview-url="https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview" loading="lazy" allow="autoplay"></iframe><a href="${esc(safeLinkedUrl(text))}" target="_blank" rel="noopener noreferrer">Driveで開く ↗</a></div></div>`;}
  function detailsPage(){
    const song=songById.get(detailSong);if(!song)return songsPage();const sections=KORYOSAN_DETAILS?.[song.id]||[],extra=detailData(song.id),cols=extra.columns.length;
    return `<main class="page-scroll details-page" data-scroll="detail"><div class="detail-hero"><div class="detail-heading-row"><h1>${esc(song.title)}</h1>${song.driveFolderUrl?`<a class="song-folder-link" href="${esc(song.driveFolderUrl)}" target="_blank" rel="noopener noreferrer">${ico('archive')}</a>`:''}</div><div class="detail-metadata"><span>${esc(song.tuning)}</span><span>Capo ${capoText(song)}</span><span>${song.bpm} BPM</span><span>${time(song.durationSeconds)}</span></div></div>
    ${sections.length?`<div class="detail-tools"><button class="detail-add-column" data-action="detail-add-column" ${cols>=14?'disabled':''} title="追記列を追加">${ico('plus')}</button></div><div class="detail-lyrics-wrap" role="region" tabindex="0" aria-label="構成・歌詞・追記メモ"><div class="detail-lyrics-table ${cols===0?'detail-no-memos':''}" style="--detail-extra-count:${cols}">
      <div class="detail-lyrics-head detail-header-v11" role="rowgroup"><span class="detail-fixed-section">構成</span><span class="detail-fixed-lyrics">歌詞</span>
      ${extra.columns.map((label,i)=>{const id=extra.columnIds[i],col=i+3,link=extra.descriptions[id]||'',url=safeLinkedUrl(link);return `<div class="detail-memo-title" style="grid-column:${col};grid-row:1"><input data-detail-title="${esc(id)}" value="${esc(label)}" maxlength="30" aria-label="追記メモの名前"><button data-action="detail-delete-column" data-column="${i}" aria-label="追記列を削除">${ico('trash')}</button></div><div class="detail-memo-link" style="grid-column:${col};grid-row:2"><textarea data-detail-desc="${esc(id)}" rows="1" maxlength="2000" aria-label="リンク・備考">${esc(link)}</textarea><a href="${esc(url||'#')}" ${url?'':'hidden'} target="_blank" rel="noopener noreferrer">↗</a>${audioWidget(link,id,extra.filenames[id])}</div><textarea class="detail-memo-overall" data-detail-overall="${esc(id)}" style="grid-column:${col};grid-row:3" rows="2" maxlength="5000" aria-label="全体の追記メモ">${esc(extra.overalls[id]||'')}</textarea>`;}).join('')}</div>
      ${sections.map((row,i)=>`<div class="detail-lyric-row" data-lyric-row="${i}" role="row"><div class="detail-structure">${esc(row.section)}</div><div class="detail-lyric-cell">${row.lyrics?`<div class="detail-lyric-text">${esc(row.lyrics)}</div>`:''}</div>${extra.columns.map((_,j)=>`<div class="detail-extra-cell detail-extra-inline"><textarea data-detail-cell="${esc(extra.columnIds[j])}" data-detail-row="${i}" maxlength="5000" rows="1" aria-label="${esc(row.section)}の追記メモ">${esc(extra.cells[i]?.[j]||'')}</textarea></div>`).join('')}</div>`).join('')}</div></div>`:'<div class="detail-placeholder">—</div>'}</main>`;
  }
  function openDetailEdit(row,column){
    if(page!=='detail'||!detailSong)return;
    const section=KORYOSAN_DETAILS?.[detailSong]?.[row];
    const extra=detailData(detailSong);
    if(!section||!Number.isInteger(column)||column<0||column>=extra.columns.length)return;
    modalOpen=true;
    const current=extra.cells[row]?.[column]||'';
    $modal.innerHTML=`<div class="overlay task-overlay" data-action="overlay"><section class="dialog task-dialog detail-dialog" role="dialog" aria-modal="true" aria-label="追記メモを編集">
      <div class="dialog-head"><h2>追記メモを編集</h2><button type="button" data-action="close-dialog" aria-label="閉じる">×</button></div>
      <div class="detail-edit-context">${esc(songById.get(detailSong)?.title)} ／ ${esc(section.section)} ／ ${esc(extra.columns[column])}</div>
      <form id="detail-edit-form" class="task-form"><input type="hidden" name="row" value="${row}"><input type="hidden" name="column" value="${column}">
        <label>内容<textarea name="content" rows="9" maxlength="5000">${esc(current)}</textarea></label>
        <div class="task-form-actions"><button type="button" class="task-cancel" data-action="close-dialog">キャンセル</button><button type="submit" class="task-submit">変更を保存</button></div>
      </form></section></div>`;
    $modal.querySelector('textarea[name="content"]')?.focus();
  }
  function submitDetailEdit(form){
    if(page!=='detail'||!detailSong)return;
    const fields=new FormData(form);
    const row=Number(fields.get('row')),column=Number(fields.get('column'));
    const sections=KORYOSAN_DETAILS?.[detailSong];
    const current=detailData(detailSong);
    if(!sections?.[row]||!Number.isInteger(column)||column<0||column>=current.columns.length)return;
    const data=state.detailEdits[detailSong]||(state.detailEdits[detailSong]=current);
    const rowValues=data.cells[row]||[];
    rowValues[column]=String(fields.get('content')||'').slice(0,5000);
    data.cells[row]=rowValues;
    save();closeData();render();toast('追記メモを保存しました');
  }
  function addDetailColumn(){
    if(page!=='detail'||!detailSong||!KORYOSAN_DETAILS?.[detailSong]?.length)return;
    const data=detailData(detailSong);
    if(data.columns.length>=14){toast('最大14列です');return;}
    const n=data.columns.length+1;
    data.noColumns=false;data.columns.unshift(`追記メモ ${n}`);
    data.columnIds.unshift(`memo_${guid().replace(/[^a-zA-Z0-9_-]/g,'')}`);
    for(const row of Object.values(data.cells))row.unshift('');
    state.detailEdits[detailSong]=data;save();render();
    const wrap=document.querySelector('.detail-lyrics-wrap');if(wrap)wrap.scrollLeft=0;
  }
  function openColumnRename(index){
    if(page!=='detail'||!detailSong)return;
    const data=detailData(detailSong);if(!Number.isInteger(index)||index<0||index>=data.columns.length)return;
    modalOpen=true;
    $modal.innerHTML=`<div class="overlay" data-action="overlay"><section class="dialog" role="dialog" aria-modal="true" aria-label="列名の変更"><div class="dialog-head"><h2>列名</h2><button data-action="close-dialog" aria-label="閉じる">×</button></div>
      <form id="detail-rename-form" class="task-form"><input type="hidden" name="column" value="${index}"><label>列名<input type="text" name="label" value="${esc(data.columns[index])}" required maxlength="30"></label><div class="task-form-actions"><button type="button" class="task-cancel" data-action="close-dialog">キャンセル</button><button type="submit" class="task-submit">保存</button></div></form></section></div>`;
  }
  function submitColumnRename(form){
    if(page!=='detail'||!detailSong)return;
    const fields=new FormData(form),i=Number(fields.get('column')),name=String(fields.get('label')||'').trim().slice(0,30),data=detailData(detailSong);
    if(!name||!Number.isInteger(i)||i<0||i>=data.columns.length)return;
    data.columns[i]=name;state.detailEdits[detailSong]=data;save();closeData();render();
  }
  function taskStatusClass(status){return {'進行中':'in-progress','レビュー依頼':'in-review','保留':'on-hold','完了':'done'}[status]||'';}
  function sortedTasks(){return state.tasks.filter(t=>(state.showCompleted||t.status!=='完了')&&(state.taskSort==='deadline'||t.members.includes(state.taskSort))).slice().sort((a,b)=>{
    if(a.status==='完了'&&b.status!=='完了')return 1;if(b.status==='完了'&&a.status!=='完了')return -1;
    return a.deadline.localeCompare(b.deadline)||(b.createdAt||0)-(a.createdAt||0);
  });}
  function taskMembersButtons(t){return `<div class="task-member-toggle">${TASK_MEMBERS.map(m=>`<button data-action="task-member" data-id="${esc(t.id)}" data-member="${m}" aria-label="${m}担当を切替" class="${t.members.includes(m)?'assigned':''}">${m}</button>`).join('')}</div>`;}
  function tasksPage(){const today=localDate();return `<main class="page-scroll tasks-page" data-scroll="task"><div class="compact-page-heading"><h1>タスク</h1></div>
   <div class="task-sortbar"><div class="sortgroup">${[['deadline','期限順'],['🟢','🟢'],['🔵','🔵'],['🟠','🟠']].map(([k,n])=>`<button data-action="task-sort" data-sort="${k}" class="${state.taskSort===k?'selected':''}">${n}</button>`).join('')}</div></div>
   <div class="tasks-table"><div class="task-table-header"><span>分類</span><span>タスク名</span><span>ステータス</span><span>期限</span><span>担当</span><span>備考</span><span></span></div>
   ${sortedTasks().map(t=>`<article class="task-table-row ${t.status==='完了'?'is-done':''} ${t.deadline<today?'task-is-overdue':''}" data-task-id="${esc(t.id)}">
      <select data-task-field="category" aria-label="分類">${taskOption('',t.category)}${TASK_CATEGORIES.map(x=>taskOption(x,t.category)).join('')}</select>
      <textarea rows="1" data-task-field="name" maxlength="200" aria-label="タスク名">${esc(t.name)}</textarea>
      <select data-task-field="status" aria-label="ステータス">${taskOption('',t.status)}${TASK_STATUSES.map(x=>taskOption(x,t.status)).join('')}</select>
      <input data-task-field="deadline" type="date" value="${esc(t.deadline)}" aria-label="期限">
      ${taskMembersButtons(t)}<textarea rows="1" data-task-field="notes" maxlength="4000" aria-label="備考">${esc(t.notes)}</textarea>
      <div class="task-actions"><button data-action="task-clone" data-id="${esc(t.id)}" title="複製">${ico('copy')}</button><button data-action="task-delete" data-id="${esc(t.id)}" title="削除">${ico('trash')}</button></div>
    </article>`).join('')}</div></main>`;}
  function taskOption(value,selected){return `<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(value)}</option>`;}
  function openTask(id=null){
    taskEditingId=id;
    const original=state.tasks.find(t=>t.id===id);
    const t=original || {category:'',name:'',status:'',deadline:localDate(),members:[],notes:'',place:''};
    modalOpen=true;
    $modal.innerHTML=`<div class="overlay task-overlay" data-action="overlay"><section class="dialog task-dialog" role="dialog" aria-modal="true" aria-label="${original?'タスクを編集':'タスクを追加'}">
      <div class="dialog-head"><h2>${original?'タスクを編集':'タスクを追加'}</h2><button data-action="close-dialog" aria-label="閉じる">×</button></div>
      <form id="task-form" class="task-form"><label>分類<select name="category">${taskOption('','')}${TASK_CATEGORIES.map(x=>taskOption(x,t.category)).join('')}</select></label>
        <label>タスク名<input name="name" type="text" maxlength="200" required value="${esc(t.name)}"></label>
        <label>ステータス<select name="status">${taskOption('','')}${TASK_STATUSES.map(x=>taskOption(x,t.status)).join('')}</select></label>
        <label>期限<input name="deadline" type="date" required value="${esc(t.deadline)}"></label>
        <fieldset><legend>担当（複数選択可）</legend><div class="task-member-options">${TASK_MEMBERS.map(x=>`<label><input type="checkbox" name="members" value="${x}" ${t.members.includes(x)?'checked':''}><span>${x}</span></label>`).join('')}</div></fieldset>
        <label>場所<input name="place" type="text" maxlength="400" value="${esc(t.place||'')}"></label><label>備考<textarea name="notes" rows="4" maxlength="4000">${esc(t.notes)}</textarea></label>
        <div class="task-form-actions">${original?`<button class="task-delete" type="button" data-action="task-delete" data-id="${esc(id)}">削除</button>`:''}<button class="task-cancel" type="button" data-action="close-dialog">キャンセル</button><button class="task-submit" type="submit">${original?'変更を保存':'追加する'}</button></div>
      </form></section></div>`;
    // スマートフォンで新規追加時にキーボードを自動表示しない。
  }
  function submitTask(form){
    const data=new FormData(form),name=String(data.get('name')||'').trim(),deadline=String(data.get('deadline')||'');
    
    if(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)){toast('期限をカレンダーから選択してください');return;}
    const task={id:taskEditingId||guid(),category:TASK_CATEGORIES.includes(data.get('category'))?data.get('category'):'',name:name.slice(0,200),status:TASK_STATUSES.includes(data.get('status'))?data.get('status'):'',deadline,members:TASK_MEMBERS.filter(x=>data.getAll('members').includes(x)),notes:String(data.get('notes')||'').slice(0,4000),place:String(data.get('place')||'').slice(0,400),createdAt:state.tasks.find(t=>t.id===taskEditingId)?.createdAt||Date.now()};
    const idx=state.tasks.findIndex(x=>x.id===task.id);if(idx>=0)state.tasks[idx]=task;else state.tasks.push(task);
    save();closeData();render();toast(idx>=0?'タスクを更新しました':'タスクを追加しました');
  }
  function slotIntro(kind){return `<div class="slot-utilities-strip"><button class="copy-button" data-action="copy-slot" data-kind="${kind}" aria-label="${kind==='practice'?'練習タイテ':'セトリ'}をコピー" title="コピー">${ico('copy')}</button></div>`;}
  function timebar(kind){
    const s=slot(kind),practice=kind==='practice';
    if(practice){
      const span=practiceSpan(s),left=span-sum('practice');
      return `<div class="timebar practice-timebar"><span id="remaining" class="remaining ${left<0?'negative':''}">残り ${left}分</span><span class="time-spacer"></span><div class="time-range" role="group" aria-label="練習時間帯"><label class="time-picker"><span class="time-value" id="practice-start-label">${esc(s.startTime)}</span><input type="time" id="practice-start" aria-label="練習開始時刻" value="${esc(s.startTime)}"></label><span>〜</span><label class="time-picker"><span class="time-value" id="practice-end-label">${esc(s.endTime)}</span><input type="time" id="practice-end" aria-label="練習終了時刻" value="${esc(s.endTime)}"></label></div></div>`;
    }
    const remaining=s.minutes*60-sum('setlist');
    return `<div class="timebar"><span id="remaining" class="remaining ${remaining<0?'negative':''}">残り ${time(remaining)}</span><span class="time-spacer"></span><label for="planned-minutes">持ち時間</label><input id="planned-minutes" type="number" min="0" max="999" inputmode="numeric" value="${s.minutes}" aria-label="持ち時間（分）"><span>分</span></div>`;
  }
  function setEntry(item,index,run=0){const song=songById.get(item.songId);if(!song)return '';
    return `<article class="draft-row capo-run-${run%4} ${song.tuning==='DADGAD'?'tuning-dadgad':song.tuning?'tuning-regular':'tuning-other'}" data-entry="${esc(item.id)}"><div class="draft-top"><button class="drag-handle" data-handle="true" aria-label="${esc(song.title)}をドラッグして並べ替え" title="ドラッグして並べ替え">⠿</button><strong>${esc(song.title)}</strong><button class="remove" data-action="remove" data-kind="setlist" data-id="${esc(item.id)}" aria-label="${esc(song.title)}を削除">×</button></div><div class="draft-meta">${song.tuning?esc(song.tuning)+' · ':''}${song.capo==null?'Capoなし':'Capo '+song.capo} · ${time(song.durationSeconds)}${song.bpm?' · '+song.bpm+' BPM':''}</div></article>`;
  }
  function pickGroup(tuning,songs,extra=false){return `<section class="pick-group ${extra?'tuning-other':tuning==='DADGAD'?'tuning-dadgad':'tuning-regular'}"><h3>${esc(tuning)}</h3>${songs.map(song=>`<button class="pick-row" data-action="add-song" data-id="${song.id}"><span><strong>${esc(song.title)}</strong><small>${extra?time(song.durationSeconds):`${song.capo==null?'Capoなし':'Capo '+song.capo} · ${time(song.durationSeconds)} · ${song.bpm} BPM`}</small></span><b>＋</b></button>`).join('')}</section>`;}
  function setlistPage(){const s=slot('setlist');return `${slotIntro('setlist')}${timebar('setlist')}
    <div class="columns"><section class="column"><header>SETLIST <span>使用 ${time(sum('setlist'))}</span></header><div class="column-scroll" data-scroll="setDraft">${s.entries.length?(()=>{let run=-1,previous=null;return s.entries.map((e,i)=>{const song=songById.get(e.songId),capo=song?.tuning?String(song.capo):'extra-'+i;if(capo!==previous)run++;previous=capo;return setEntry(e,i,run);}).join('');})():''}</div></section><div class="vertical-rule"></div><section class="column"><header>持ち曲（タップで追加）</header><div class="column-scroll" data-scroll="setLibrary">${KORYOSAN_SONGS.slice().sort(byCapo).map(song=>`<button class="pick-row" data-action="add-song" data-id="${song.id}"><span><strong>${esc(song.title)}</strong><small>Capo ${song.capo} · ${time(song.durationSeconds)} · ${song.bpm} BPM</small></span><b>＋</b></button>`).join('')}${pickGroup('その他',KORYOSAN_EXTRA,true)}</div></section></div>`;}
  const optionsForMinutes=value=>Array.from({length:48},(_,i)=>5*(i+1)).map(v=>`<option value="${v}" ${v===value?'selected':''}>${v}分</option>`).join('');
  function practiceEntry(item,index,elapsed){const preset=practiceById.get(item.presetId);if(!preset)return '';
    const start=minutesOf(slot('practice').startTime)??0;
    return `<article class="draft-row practice-row" data-entry="${esc(item.id)}">
      <div class="draft-top"><button class="drag-handle" data-handle="true" aria-label="${esc(preset.title)}を並べ替え">⠿</button><strong>${esc(preset.title)}</strong><span class="practice-slot-time" data-time-entry="${esc(item.id)}">${clockOf(start+elapsed)}〜${clockOf(start+elapsed+item.minutes)}</span><button class="remove" data-action="remove" data-kind="practice" data-id="${esc(item.id)}" aria-label="削除">×</button></div>
      <div class="practice-edit"><select aria-label="${esc(preset.title)}の継続時間" data-select="entry-minutes" data-id="${esc(item.id)}">${optionsForMinutes(item.minutes)}</select><textarea aria-label="${esc(preset.title)}の備考" rows="1" maxlength="3000" data-input="note" data-id="${esc(item.id)}">${esc(item.note)}</textarea></div>
    </article>`;
  }
  function practiceEntries(entries){let elapsed=0;return entries.map((item,i)=>{const row=practiceEntry(item,i,elapsed);elapsed+=item.minutes;return row;}).join('');}
  function practicePage(){const s=slot('practice');return `${slotIntro('practice')}${timebar('practice')}
    <div class="columns practice-columns"><section class="column"><header>タイムテーブル <span></span></header><div class="column-scroll" data-scroll="practiceDraft">${practiceEntries(s.entries)}</div></section><div class="vertical-rule"></div><section class="column"><header>メニュー</header><div class="column-scroll practice-menu" data-scroll="practiceLibrary">${KORYOSAN_PRACTICE.map(item=>`<button class="pick-row practice-pick" data-action="add-practice" data-id="${item.id}"><span><strong>${esc(item.title)}</strong><small>${item.minutes}分</small></span><b>＋</b></button>`).join('')}</div></section></div>`;}
  // スケジュール・空き日程・会議（この端末内にのみ保存）
  const NEW_CATEGORIES=[{id:'',label:''},{id:'practice',label:'💪練習'},{id:'live',label:'🎸ライブ'},{id:'other',label:'🥟その他'}];
  const DAY_LABELS=['日','月','火','水','木','金','土'];
  const fiveMinuteTimes=Array.from({length:288},(_,i)=>`${pad(Math.floor(i/12))}:${pad((i%12)*5)}`);
  const dateOfKey=key=>new Date(`${key}T12:00:00`);
  const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const addDays=(key,n)=>{const d=dateOfKey(key);d.setDate(d.getDate()+n);return dateKey(d);};
  const meetingById=id=>state.meetings.find(m=>m.id===id);
  function resizeOne(el){
    if(el?.tagName!=='TEXTAREA')return;
    el.style.height='auto';el.style.height=`${Math.max(25,el.scrollHeight)}px`;
  }
  function resizeAutos(node){node?.querySelectorAll('textarea:not(.task-form textarea)').forEach(resizeOne);}
  function newTimeOptions(selected){return `<option value="" ${!selected?'selected':''}></option>`+fiveMinuteTimes.map(t=>`<option value="${t}" ${t===selected?'selected':''}>${t}</option>`).join('');}
  function scheduleCard(s){
    const today=localDate(),past=s.date<today;
    return `<article class="k6-schedule ${s.category?'k6-cat-'+s.category:'k6-cat-none'} ${past?'k6-past':''}" data-schedule-id="${esc(s.id)}">
      <div class="k6-schedule-info">
        <label><small>項目</small><select data-schedule-field="category" aria-label="予定の種類">${NEW_CATEGORIES.map(c=>`<option value="${c.id}" ${c.id===s.category?'selected':''}>${c.label}</option>`).join('')}</select></label>
        <label><small>日付</small><input data-schedule-field="date" type="date" value="${esc(s.date)}" aria-label="予定の日付"></label>
        <label class="k6-time-field"><small>時間</small><span class="k6-time-selects"><select data-schedule-field="start" aria-label="開始時刻">${newTimeOptions(s.start)}</select><span>〜</span><select data-schedule-field="end" aria-label="終了時刻">${newTimeOptions(s.end)}</select></span></label>
        <label><small>場所</small><input data-schedule-field="place" type="text" maxlength="400" value="${esc(s.place)}" aria-label="場所"></label>
      </div>
      <div class="k6-schedule-note"><textarea data-schedule-field="notes" rows="1" maxlength="5000" aria-label="予定の備考">${esc(s.notes)}</textarea><button class="k6-remove" data-action="schedule-delete" data-id="${esc(s.id)}" title="予定を削除" aria-label="予定を削除">${ico('trash')}</button></div>
    </article>`;
  }
  function schedulePage(){
    const future=state.schedules.filter(s=>s.date>=localDate());
    const past=state.schedules.filter(s=>s.date<localDate());
    const sort=(xs)=>xs.sort((a,b)=>{
      const draft=a.category===''&&a.place===''&&a.start===''&&a.end===''&&a.notes==='';
      const draftB=b.category===''&&b.place===''&&b.start===''&&b.end===''&&b.notes==='';
      if(draft!==draftB)return draft?-1:1;
      return a.date.localeCompare(b.date)||a.start.localeCompare(b.start)||(b.createdAt||0)-(a.createdAt||0);
    });
    const entries=[...sort(future),...(state.showPastSchedules?sort(past):[])];
    return `<main class="page-scroll k6-page k6-schedule-page" data-scroll="schedule"><div class="k6-content">${entries.length?entries.map(scheduleCard).join(''):'<div class="k6-empty">予定はありません</div>'}</div></main>`;
  }
  // 日本の国民の祝日（2000〜2099年を主対象、振替休日・国民の休日にも対応）
  const holidayMemo=new Map();
  const monNth=(year,month,n)=>{let d=new Date(year,month-1,1,12);return `${year}-${pad(month)}-${pad(1+(8-d.getDay())%7+(n-1)*7)}`;};
  function holidaysOf(year){
    if(holidayMemo.has(year))return holidayMemo.get(year);
    const days=new Set(),add=(m,d)=>days.add(`${year}-${pad(m)}-${pad(d)}`);
    add(1,1);add(2,11);if(year>=2020)add(2,23);
    add(4,29);add(5,3);add(5,4);add(5,5);add(8,11);add(11,3);add(11,23);
    add(3,Math.floor(20.8431+.242194*(year-1980)-Math.floor((year-1980)/4)));
    add(9,Math.floor(23.2488+.242194*(year-1980)-Math.floor((year-1980)/4)));
    days.add(monNth(year,1,2));days.add(monNth(year,9,3));
    if(year===2020||year===2021){
      days.delete(`${year}-08-11`);
      add(8,year===2020?10:8);
      add(7,year===2020?23:22);
      add(7,year===2020?24:23);
    }else{days.add(monNth(year,7,3));days.add(monNth(year,10,2));}
    if(year<2000){days.delete(`${year}-02-23`);}
    if(year>=1985){const arr=[...days];for(const k of arr){const mid=addDays(k,1),after=addDays(k,2);if(days.has(after)&&dateOfKey(mid).getDay()!==0&&!days.has(mid))days.add(mid);}}
    const sunday=[...days].filter(k=>dateOfKey(k).getDay()===0).sort();
    for(const date of sunday){let sub=addDays(date,1);while(days.has(sub))sub=addDays(sub,1);days.add(sub);}
    holidayMemo.set(year,days);return days;
  }
  function availableDay(key){
    const d=dateOfKey(key),wd=d.getDay(),holiday=holidaysOf(d.getFullYear()).has(key);
    const vals=state.availability[key]||{};
    return `<div class="k6-avail-row ${key===localDate()?'k6-today':''}" data-day="${key}">
      <div class="k6-date">${d.getMonth()+1}/${d.getDate()}<small>${d.getFullYear()}</small></div>
      <div class="k6-day ${holiday||wd===0?'k6-red':wd===6?'k6-blue':''}">${DAY_LABELS[wd]}${holiday?'祝':''}</div>
      ${TASK_MEMBERS.map(m=>`<label class="k6-member"><textarea data-avail-day="${key}" data-member="${m}" rows="1" maxlength="400" aria-label="${key} ${m}の予定">${esc(vals[m]||'')}</textarea></label>`).join('')}
    </div>`;
  }
  function availabilityPage(){return `<div class="k6-availability"><div class="k6-avail-head"><span>日付</span><span>曜日</span>${TASK_MEMBERS.map(m=>`<span>${m}</span>`).join('')}</div><div id="avail-scroll" class="k6-avail-scroll"><div id="avail-days"></div></div></div>`;}
  function buildAvailability(focusDay,retain=false){
    const scroll=document.getElementById('avail-scroll'),parent=document.getElementById('avail-days');if(!scroll||!parent)return;
    const first=addDays(focusDay,-40),last=addDays(focusDay,150),rows=[];
    for(let d=first;d<=last;d=addDays(d,1))rows.push(availableDay(d));
    parent.innerHTML=rows.join('');availabilityRange={first,last,anchor:focusDay,expanding:false};resizeAutos(parent);
    requestAnimationFrame(()=>{
      const element=Array.from(parent.children).find(x=>x.dataset.day===focusDay);
      if(element)scroll.scrollTop=Math.max(0,element.offsetTop-parent.offsetTop);
    });
  }
  function mountAvailability(day){buildAvailability(day);}
  function extendAvailability(side){
    const box=document.getElementById('avail-scroll'),parent=document.getElementById('avail-days');
    if(!box||!parent||!availabilityRange||availabilityRange.expanding)return;
    availabilityRange.expanding=true;
    const {first,last}=availabilityRange,arr=[];
    if(side==='past'){
      const target=addDays(first,-55),oldHeight=parent.scrollHeight;
      for(let day=target;day<first;day=addDays(day,1))arr.push(availableDay(day));
      parent.insertAdjacentHTML('afterbegin',arr.join(''));availabilityRange.first=target;
      box.scrollTop+=parent.scrollHeight-oldHeight;
    }else{
      const target=addDays(last,95);
      for(let day=addDays(last,1);day<=target;day=addDays(day,1))arr.push(availableDay(day));
      parent.insertAdjacentHTML('beforeend',arr.join(''));availabilityRange.last=target;
    }
    resizeAutos(parent);availabilityRange.expanding=false;
  }
  function meetingCard(m){
    const open=!meetingCollapsed.has(m.id);
    return `<article class="k6-meeting" data-meeting-id="${esc(m.id)}"><div class="k6-meeting-head">
      <button class="k6-expand ${open?'open':''}" data-action="meeting-expand" data-id="${esc(m.id)}" aria-expanded="${open}" title="${open?'閉じる':'開く'}">${ico('chevron')}</button>
      <input type="text" data-meeting-title="${esc(m.id)}" maxlength="300" value="${esc(m.title)}" aria-label="会議タイトル">
      <button class="k6-remove" data-action="meeting-delete" data-id="${esc(m.id)}" title="議題を削除" aria-label="議題を削除">${ico('trash')}</button>
    </div>${open?`<div class="k6-meeting-body">${m.rows.map(row=>`<div class="k6-meeting-row"><textarea data-meeting-row="${esc(m.id)}" data-row-id="${esc(row.id)}" rows="1" maxlength="10000" aria-label="議題内容">${esc(row.text)}</textarea><button class="k6-remove" data-action="meeting-delete-row" data-id="${esc(m.id)}" data-row-id="${esc(row.id)}" title="この行を削除" aria-label="この行を削除">${ico('trash')}</button></div>`).join('')}<div class="k6-meeting-footer"><button class="k6-meeting-plus" data-action="meeting-add-row" data-id="${esc(m.id)}" aria-label="記述欄を追加" title="記述欄を追加">${ico('plus')}</button></div></div>`:''}</article>`;
  }
  function meetingPage(){return `<main class="page-scroll k6-page k6-meeting-page" data-scroll="meeting"><div class="k6-content">${state.meetings.length?state.meetings.map(meetingCard).join(''):'<div class="k6-empty">議題はありません</div>'}</div></main>`;}

  // 収支画面: 全件集計を画面内で行い、表示フィルタは計算へ影響させない
  const yen=n=>new Intl.NumberFormat('ja-JP').format(n)+'円';
  function accountingTotals(){return state.accounting.reduce((a,x)=>{const n=Number(x.amount);if(x.amount!==''&&Number.isFinite(n)){if(x.type==='income')a.income+=n;else if(x.type==='expense')a.expense+=n;}return a;},{income:0,expense:0});}
  function refreshAccountingTotals(){const a=accountingTotals(),net=a.income-a.expense;const els=document.querySelectorAll('.account-summary strong');if(els.length!==3)return;els[0].textContent=yen(a.income);els[1].textContent=yen(a.expense);els[2].textContent=(net<0?'−':'')+yen(Math.abs(net));}
  function accountRow(x){const opts=(arr,v)=>arr.map(([k,n])=>`<option value="${esc(k)}" ${k===v?'selected':''}>${esc(n)}</option>`).join('');return `<article class="account-row ${x.type==='income'?'account-income':x.type==='expense'?'account-expense':''}" data-account-id="${esc(x.id)}">
    <label><small>収支</small><select data-account-field="type" aria-label="収入・支出">${opts([['',''],['income','収入'],['expense','支出']],x.type)}</select></label>
    <label><small>日付</small><input type="date" data-account-field="date" value="${esc(x.date)}"></label>
    <label><small>対応者</small><select data-account-field="member" aria-label="対応者">${opts([['',''],...TASK_MEMBERS.map(m=>[m,m])],x.member)}</select></label>
    <label><small>品目</small><textarea rows="1" data-account-field="item" maxlength="300">${esc(x.item)}</textarea></label>
    <label><small>金額</small><input type="text" inputmode="numeric" pattern="[0-9]*" data-account-field="amount" value="${esc(x.amount)}" maxlength="12"></label>
    <label><small>備考</small><textarea rows="1" data-account-field="notes" maxlength="5000">${esc(x.notes)}</textarea></label>
    <button class="account-delete" data-action="account-delete" data-id="${esc(x.id)}" title="削除">${ico('trash')}</button>
  </article>`;}
  function accountingPage(){const sums=accountingTotals(),net=sums.income-sums.expense;const rows=state.accounting.filter(x=>accountingFilter==='all'||x.type===accountingFilter).sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||0)-(a.createdAt||0));return `<main class="page-scroll accounting-page" data-scroll="accounting"><div class="account-toolbar">
    <div class="sortgroup">${[['all','全て'],['income','収入'],['expense','支出']].map(([k,n])=>`<button data-action="account-filter" data-filter="${k}" class="${accountingFilter===k?'selected':''}">${n}</button>`).join('')}</div>
    <div class="account-summary"><div><small>合計収入</small><strong>${yen(sums.income)}</strong></div><div><small>合計支出</small><strong>${yen(sums.expense)}</strong></div><div><small>収支合計</small><strong>${net<0?'−':''}${yen(Math.abs(net))}</strong></div></div></div>
    <div class="account-sheet"><div class="account-head"><span>収支</span><span>日付</span><span>対応者</span><span>品目</span><span>金額</span><span>備考</span><span></span></div>${rows.map(accountRow).join('')}</div><div class="account-footer"><button data-action="account-add" class="account-add">${ico('plus')} 行を追加</button></div></main>`;}
  // 文字列そのものが連続して含まれている箇所を返す（大文字/小文字・記号を区別）
  function searchResults(query){const q=String(query||''),found=[];if(!q)return found;
    const add=(page,label,value,meta={})=>{if(found.length>=10)return;const text=String(value??'');const i=text.indexOf(q);if(i<0)return;let snippet=text.slice(Math.max(0,i-22),i+q.length+55).replace(/\s+/g,' ');if(i>22)snippet='…'+snippet;found.push({page,label,snippet,...meta});};
    for(const t of state.tasks)add('tasks','タスク｜'+t.name,[t.name,t.notes,t.category,t.deadline,t.status,t.members.join(' ')].join('\n'),{id:t.id});
    for(const song of KORYOSAN_SONGS){add('songs','曲リスト｜'+song.title,[song.title,song.tuning,song.bpm].join('\n'),{songId:song.id});
      const details=KORYOSAN_DETAILS?.[song.id]||[],memo=state.detailEdits[song.id];
      details.forEach((part,i)=>add('detail',`${song.title}｜${part.section}`,[part.section,part.lyrics,...(memo?.cells?.[i]||[])].join('\n'),{songId:song.id,section:i}));
      (memo?.columns||[]).forEach((col,i)=>{const id=memo.columnIds?.[i];add('detail',`${song.title}｜${col}`,[col,memo.descriptions?.[id],memo.overalls?.[id]].join('\n'),{songId:song.id});});
    }
    for(const x of state.schedules)add('schedule','スケジュール｜'+x.date,[x.date,x.place,x.notes,x.start,x.end].join('\n'),{id:x.id});
    for(let i=0;i<3;i++){
      const practice=state.practiceSlots[i],list=state.setlistSlots[i];add('practice','練習タイテ｜'+practice.name,practice.name,{slot:i});add('setlist','セトリ｜'+list.name,list.name,{slot:i});
      for(const e of practice.entries)add('practice','練習タイテ｜'+practice.name,[practiceById.get(e.presetId)?.title,e.note].join('\n'),{slot:i,id:e.id});
      for(const e of list.entries)add('setlist','セトリ｜'+list.name,songById.get(e.songId)?.title||'',{slot:i,id:e.id});
    }
    for(const m of state.meetings){add('meeting','会議｜'+m.title,m.title,{id:m.id});for(const r of m.rows)add('meeting','会議｜'+m.title,r.text,{id:m.id});}
    for(const x of state.accounting)add('accounting','会計｜'+x.item,[x.item,x.notes,x.date,x.member,x.amount,x.type].join('\n'),{id:x.id});
    for(const [day,people] of Object.entries(state.availability))for(const [member,value] of Object.entries(people))add('availability','空き日程｜'+day+' '+member,[day,member,value].join('\n'),{day});
    add('metronome','メトロノーム','メトロノーム BPM テンポ');return found.slice(0,10);
  }
  function searchCards(){if(!searchQuery)return '<p class="search-empty">検索文字列を入力してください</p>';const results=searchResults(searchQuery);return results.length?results.map((r,i)=>`<button data-action="search-open" data-index="${i}" class="search-result"><strong>${esc(r.label)}</strong><span>${esc(r.snippet)}</span>${ico('chevron')}</button>`).join(''):'<p class="search-empty">一致する箇所はありません</p>';}
  function searchPage(){return `<main class="page-scroll search-page" data-scroll="search"><div class="search-box"><label for="global-search">検索</label><input type="search" id="global-search" autocomplete="off" spellcheck="false" placeholder="検索キーワード" value="${esc(searchQuery)}"><small>文字列一致・最大10件</small></div><div class="search-results" id="search-results">${searchCards()}</div></main>`;}
  function openSearchResult(index){const r=searchResults(searchQuery)[index];if(!r)return;
    if(r.page==='detail'){page='detail';detailSong=r.songId;scrollPos.detail=0;scrollPos.detailX=0;}
    else{page=r.page;if(r.page==='practice')state.activePractice=r.slot||0;if(r.page==='setlist')state.activeSetlist=r.slot||0;if(r.page==='tasks'){state.taskSort='deadline';state.showCompleted=true;}
      if(r.page==='accounting')accountingFilter='all';if(r.page==='schedule')state.showPastSchedules=true;if(r.page==='meeting')meetingCollapsed.delete(r.id);}
    render();let selector=r.page==='tasks'?`[data-task-id="${r.id}"]`:r.page==='songs'?`[data-song-row="${r.songId}"]`:r.page==='detail'&&r.section!=null?`[data-lyric-row="${r.section}"]`:r.page==='schedule'?`[data-schedule-id="${r.id}"]`:r.page==='meeting'?`[data-meeting-id="${r.id}"]`:r.page==='accounting'?`[data-account-id="${r.id}"]`:r.page==='availability'?`[data-day="${r.day}"]`:r.id?`[data-entry="${r.id}"]`:null;
    setTimeout(()=>{const target=selector?document.querySelector(selector):null;if(target){target.scrollIntoView({block:'center',inline:'nearest'});target.classList.add('search-flash');setTimeout(()=>target.classList.remove('search-flash'),1800);}else if(r.day&&r.page==='availability')mountAvailability(r.day);},80);
  }
  function render(){storeScroll();window.KoryoMetronome?.unmount();
    $app.innerHTML=`${header()}<div class="app-content">${page==='tasks'?tasksPage():page==='songs'?songsPage():page==='detail'?detailsPage():page==='setlist'?setlistPage():page==='practice'?practicePage():page==='schedule'?schedulePage():page==='availability'?availabilityPage():page==='meeting'?meetingPage():page==='accounting'?accountingPage():page==='search'?searchPage():'<div id="metronome-root"></div>'}</div>${tabs()}`;
    restoreScroll();if(page==='availability'){if(!availabilityRange)mountAvailability(localDate());else buildAvailability(availabilityRange.anchor,true);}resizeAutos($app);if(page==='metronome')window.KoryoMetronome?.mount(document.getElementById('metronome-root'));
    document.title=`さいわいさん${page==='detail'?'｜楽譜・詳細':''}`;
    const nav=$app.querySelector('.tabbar'),active=nav?.querySelector('.tab.active');if(nav&&active&&nav.scrollWidth>nav.clientWidth)active.scrollIntoView({inline:'nearest',block:'nearest'});
  }
  function updateTime(){
    const el=document.getElementById('remaining');if(!el)return;
    const isPractice=page==='practice',kind=isPractice?'practice':'setlist',s=slot(kind),used=sum(kind);
    const remain=isPractice?practiceSpan(s)-used:s.minutes*60-used;
    el.textContent=isPractice?`残り ${remain}分`:'残り '+time(remain);el.classList.toggle('negative',remain<0);
    const heading=document.querySelector('.column:first-child header span');if(heading)heading.textContent=isPractice?'':`使用 ${time(used)}`;
    if(isPractice){let elapsed=0;const start=minutesOf(s.startTime)??0;
      for(const item of s.entries){const label=[...document.querySelectorAll('[data-time-entry]')].find(el=>el.dataset.timeEntry===item.id);if(label)label.textContent=`${clockOf(start+elapsed)}〜${clockOf(start+elapsed+item.minutes)}`;elapsed+=item.minutes;}
    }
  }
  function moveEntry(kind,id,targetId){const list=slot(kind).entries;const from=list.findIndex(e=>e.id===id),to=list.findIndex(e=>e.id===targetId);if(from<0||to<0||from===to)return;const [entry]=list.splice(from,1);list.splice(to,0,entry);save();render();}
  function openData(){modalOpen=true;$modal.innerHTML=`<div class="overlay" data-action="overlay"><section class="dialog" role="dialog" aria-modal="true"><div class="dialog-head"><h2>データ</h2><button data-action="close-dialog" aria-label="閉じる">×</button></div><p>このテスト版の内容は使用端末のブラウザにのみ保存されます。</p><div class="dialog-actions"><button data-action="export-data">JSONバックアップを保存</button><button data-action="import-data">JSONを復元</button><button data-action="reset-samples">サンプルに戻す</button><input type="file" id="backup-input" accept=".json,application/json" hidden></div></section></div>`;}
  function closeData(){modalOpen=false;$modal.innerHTML='';setTimeout(flushRemote,0);}
  function downloadBackup(){const obj={app:'SaiwaiSan_TestPWA',version:11,exportedAt:new Date().toISOString(),state,metronome:window.KoryoMetronome?.snapshot()};const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='saiwaisan-test-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);toast('バックアップを保存しました');}
  async function readBackup(file){if(!file)return;if(file.size>8*1024*1024){toast('8MB以下のファイルを指定してください');return;}try{
      const obj=JSON.parse(await file.text());if(obj.app!=='SaiwaiSan_TestPWA'||!obj.state)throw Error('さいわいさん用のバックアップを選んでください');
      const nextState=validate(obj.state);
      // 古いバックアップには新画面のデータがないため、復元時に誤って消さない。
      for(const key of ['schedules','availability','meetings','accounting'])if(!Object.prototype.hasOwnProperty.call(obj.state,key))nextState[key]=clone(state[key]);
      if(!confirm('この端末のテストデータをバックアップの内容で置き換えますか？'))return;
      if(obj.metronome)window.KoryoMetronome?.restore(obj.metronome);
      state=nextState;save();closeData();render();toast('バックアップを読み込みました');
    }catch(e){console.error(e);alert('読み込めませんでした：'+e.message);}}
  function slotText(kind){
    const s=slot(kind);
    if(kind==='practice'){let elapsed=0;const start=minutesOf(s.startTime)??0;const lines=s.entries.map(e=>{const p=practiceById.get(e.presetId);const line=`${clockOf(start+elapsed)}〜　${p?.title||''}　${e.minutes}分${e.note?'　'+e.note:''}`;elapsed+=e.minutes;return line;});return ['＝＝＝＝＝＝＝',s.name,`${s.startTime}〜${s.endTime}`,...lines,'＝＝＝＝＝＝＝'].join('\n');}
    let count=0;
    return ['＝＝＝＝＝＝＝',s.name,'',...s.entries.map(entry=>{
      const song=songById.get(entry.songId);if(!song)return '';
      if(!song.tuning)return song.title;
      count++;
      return `${count}. ${song.title}　${song.capo===null?'Capoなし':'Capo'+song.capo}　${song.tuning}　${song.bpm} BPM　${time(song.durationSeconds)}`;
    }),'＝＝＝＝＝＝＝'].join('\n');
  }
  async function copySlot(kind){
    const txt=slotText(kind);
    try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(txt);toast('コピーしました');}
    catch(_){const t=document.createElement('textarea');t.value=txt;document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();toast(ok?'コピーしました':'コピーできませんでした');}
  }
  function openSlotRename(kind,i){
    const items=kind==='practice'?state.practiceSlots:state.setlistSlots,s=items[i];if(!s)return;
    modalOpen=true;
    $modal.innerHTML=`<div class="overlay" data-action="overlay"><section class="dialog" role="dialog" aria-modal="true" aria-label="スロット名変更"><div class="dialog-head"><h2>スロット名</h2><button type="button" data-action="close-dialog" aria-label="閉じる">×</button></div>
    <form class="task-form" id="slot-rename-form"><input type="hidden" name="kind" value="${kind}"><input type="hidden" name="index" value="${i}"><label>名称<input name="name" type="text" maxlength="40" required value="${esc(s.name)}"></label><div class="task-form-actions"><button type="button" class="task-cancel" data-action="close-dialog">キャンセル</button><button type="submit" class="task-submit">保存</button></div></form></section></div>`;
  }
  function submitSlotRename(form){
    const data=new FormData(form),kind=data.get('kind'),index=Number(data.get('index')),name=String(data.get('name')||'').trim().slice(0,40);
    if(!['practice','setlist'].includes(kind)||!Number.isInteger(index)||index<0||index>=3||!name)return;
    (kind==='practice'?state.practiceSlots:state.setlistSlots)[index].name=name;save();closeData();render();
  }
  function action(el){const what=el.dataset.action;
    if(what==='tab'){page=el.dataset.page;detailSong=null;render();return;}
    if(what==='search-open'){openSearchResult(Number(el.dataset.index));return;}
    if(what==='account-filter'){accountingFilter=['all','income','expense'].includes(el.dataset.filter)?el.dataset.filter:'all';render();return;}
    if(what==='account-add'){state.accounting.push({id:guid(),type:'',date:localDate(),member:'',item:'',amount:'',notes:'',createdAt:Date.now()});accountingFilter='all';save();render();return;}
    if(what==='account-delete'){if(!confirm('削除しますか？'))return;state.accounting=state.accounting.filter(a=>a.id!==el.dataset.id);save();render();return;}
    if(what==='audio-preview'){const holder=el.closest('.drive-audio')?.querySelector('.drive-iframe-holder');if(holder){holder.hidden=!holder.hidden;const frame=holder.querySelector('iframe');if(!holder.hidden&&!frame.src)frame.src=frame.dataset.previewUrl;}return;}
    if(what==='task-member'){const t=state.tasks.find(t=>t.id===el.dataset.id),member=el.dataset.member;if(!t||!TASK_MEMBERS.includes(member))return;t.members=t.members.includes(member)?t.members.filter(m=>m!==member):[...t.members,member];save();render();return;}
    if(what==='task-clone'){const t=state.tasks.find(x=>x.id===el.dataset.id);if(!t||!confirm(`「${t.name}」を複製しますか？`))return;state.tasks.unshift({...clone(t),id:guid(),createdAt:Date.now()});state.taskSort='deadline';save();render();return;}
    if(what==='detail'){scrollPos.detail=0;scrollPos.detailX=0;detailSong=el.dataset.song;page='detail';render();return;}
    if(what==='detail-back'){page='songs';detailSong=null;render();return;}
    
    if(what==='detail-add-column'){addDetailColumn();return;}
    
    if(what==='detail-delete-column'){
      const index=Number(el.dataset.column),data=detailData(detailSong),id=data.columnIds[index];
      if(!id||!confirm(`「${data.columns[index]}」を削除しますか？ この列のメモも削除されます。`))return;
      data.columns.splice(index,1);data.columnIds.splice(index,1);delete data.descriptions[id];delete data.overalls[id];delete data.filenames[id];delete data.reviews[id];
      for(const row of Object.values(data.cells))row.splice(index,1);
      if(!data.columns.length){data.noColumns=true;data.cells={};data.descriptions={};data.overalls={};data.filenames={};data.reviews={};}
      state.detailEdits[detailSong]=data;save();render();return;
    }
    if(what==='task-add'){state.taskSort='deadline';state.tasks.unshift({id:guid(),category:'',name:'',status:'',deadline:localDate(),members:[],notes:'',createdAt:Date.now()});scrollPos.task=0;save();render();return;}
    if(what==='task-sort'){state.taskSort=['deadline',...TASK_MEMBERS].includes(el.dataset.sort)?el.dataset.sort:'deadline';save();render();return;}
    if(what==='task-toggle-completed'){state.showCompleted=!state.showCompleted;save();render();return;}
    
    if(what==='task-delete'){const id=el.dataset.id;const task=state.tasks.find(t=>t.id===id);if(!task||!confirm(`「${task.name}」を削除しますか？`))return;state.tasks=state.tasks.filter(t=>t.id!==id);save();render();toast('タスクを削除しました');return;}
    if(what==='schedule-add'){state.schedules.unshift({id:guid(),category:'',date:localDate(),start:'',end:'',place:'',notes:'',createdAt:Date.now()});scrollPos.schedule=0;save();render();return;}
    if(what==='schedule-toggle-past'){state.showPastSchedules=!state.showPastSchedules;save();render();return;}
    if(what==='schedule-delete'){if(!confirm('削除しますか？'))return;state.schedules=state.schedules.filter(x=>x.id!==el.dataset.id);save();render();return;}
    if(what==='availability-today'){mountAvailability(localDate());return;}
    if(what==='meeting-add'){const id=guid();state.meetings.push({id,title:'',createdAt:Date.now(),rows:[{id:guid(),text:''}]});meetingCollapsed.delete(id);scrollPos.meeting=Number.MAX_SAFE_INTEGER;save();render();return;}
    if(what==='meeting-delete'){if(!confirm('削除しますか？'))return;state.meetings=state.meetings.filter(x=>x.id!==el.dataset.id);save();render();return;}
    if(what==='meeting-expand'){meetingCollapsed.has(el.dataset.id)?meetingCollapsed.delete(el.dataset.id):meetingCollapsed.add(el.dataset.id);render();return;}
    if(what==='meeting-toggle-all'){const allOpen=state.meetings.every(x=>!meetingCollapsed.has(x.id));for(const item of state.meetings){if(allOpen)meetingCollapsed.add(item.id);else meetingCollapsed.delete(item.id);}render();return;}
    if(what==='meeting-add-row'){const item=state.meetings.find(m=>m.id===el.dataset.id);if(!item)return;item.rows.push({id:guid(),text:''});meetingCollapsed.delete(item.id);save();render();return;}
    if(what==='meeting-delete-row'){if(!confirm('この行を削除しますか？'))return;const item=state.meetings.find(m=>m.id===el.dataset.id);if(!item)return;item.rows=item.rows.filter(r=>r.id!==el.dataset.rowId);save();render();return;}
    if(what==='sort'){state.sort=el.dataset.sort;save();render();return;}
    if(what==='slot-rename'){openSlotRename(el.dataset.kind,Number(el.dataset.index));return;}
    if(what==='slot'){const idx=Number(el.dataset.index);if(idx<0||idx>=SLOTS)return;if(el.dataset.kind==='practice')state.activePractice=idx;else state.activeSetlist=idx;save();render();return;}
    if(what==='add-song'){if(!songById.has(el.dataset.id))return;slot('setlist').entries.push({id:guid(),songId:el.dataset.id});save();render();return;}
    if(what==='add-practice'){const item=practiceById.get(el.dataset.id);if(!item)return;slot('practice').entries.push({id:guid(),presetId:item.id,minutes:item.minutes,note:''});save();render();return;}
    if(what==='remove'){const kind=el.dataset.kind;const s=slot(kind);s.entries=s.entries.filter(e=>e.id!==el.dataset.id);save();render();return;}
    if(what==='copy-slot'){void copySlot(el.dataset.kind);return;}
    if(what==='data'){openData();return;}
    if(what==='close-dialog'){closeData();return;}
    if(what==='overlay'){closeData();return;}
    
    
    if(what==='export-data'){downloadBackup();return;}
    if(what==='reset-samples'){if(!confirm('この端末での編集を削除してサンプルへ戻しますか？'))return;localStorage.removeItem('saiwaisan.test.data.v1');location.reload();return;}
    if(what==='import-data'){document.getElementById('backup-input')?.click();return;}
  }
  // All event handlers are delegated because screen DOM is replaced on tab switches.
  document.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn||btn.disabled)return;if(btn.dataset.action==='overlay'&&e.target!==btn)return;action(btn);});
  document.addEventListener('submit',e=>{if(e.target.id==='slot-rename-form'){e.preventDefault();submitSlotRename(e.target);}});
  document.addEventListener('input',e=>{
    const el=e.target;
    if(el.id==='global-search'){searchQuery=el.value;const box=document.getElementById('search-results');if(box)box.innerHTML=searchCards();return;}
    const taskId=el.closest('[data-task-id]')?.dataset.taskId;
    if(el.dataset.taskField && taskId){const t=state.tasks.find(x=>x.id===taskId),k=el.dataset.taskField;if(t&&['name','notes'].includes(k)){t[k]=el.value.slice(0,k==='name'?200:4000);saveDebounced();resizeOne(el);}return;}
    if(el.dataset.accountField){const t=state.accounting.find(x=>x.id===el.closest('[data-account-id]')?.dataset.accountId),k=el.dataset.accountField;if(!t)return;
      if(k==='item'||k==='notes'){t[k]=el.value.slice(0,k==='item'?300:5000);saveDebounced();resizeOne(el);}
      if(k==='amount'){const clean=el.value.replace(/[^0-9]/g,'').slice(0,12);el.value=clean;t.amount=clean;saveDebounced();refreshAccountingTotals();}return;
    }
    if(el.dataset.detailTitle && detailSong){const data=detailData(detailSong),i=data.columnIds.indexOf(el.dataset.detailTitle);if(i>=0){data.columns[i]=el.value.slice(0,30);state.detailEdits[detailSong]=data;saveDebounced();}return;}
    if(el.dataset.detailDesc && detailSong){const data=detailData(detailSong),id=el.dataset.detailDesc;if(data.columnIds.includes(id)){data.descriptions[id]=el.value.slice(0,2000);state.detailEdits[detailSong]=data;saveDebounced();resizeOne(el);}return;}
    if(el.dataset.detailOverall && detailSong){const data=detailData(detailSong),id=el.dataset.detailOverall;if(data.columnIds.includes(id)){data.overalls[id]=el.value.slice(0,5000);state.detailEdits[detailSong]=data;saveDebounced();resizeOne(el);}return;}
    if(el.dataset.detailFilename && detailSong){const data=detailData(detailSong),id=el.dataset.detailFilename;if(data.columnIds.includes(id)){data.filenames[id]=el.value.slice(0,180);state.detailEdits[detailSong]=data;saveDebounced();}return;}
    if(el.dataset.detailCell && detailSong){const data=detailData(detailSong),id=el.dataset.detailCell,i=data.columnIds.indexOf(id),row=Number(el.dataset.detailRow);if(i>=0&&row>=0){const cells=data.cells[row]||[];cells[i]=el.value.slice(0,5000);data.cells[row]=cells;state.detailEdits[detailSong]=data;saveDebounced();resizeOne(el);}return;}

    if(el.dataset.scheduleField){
      const s=state.schedules.find(x=>x.id===el.closest('[data-schedule-id]')?.dataset.scheduleId);
      if(s&&['place','notes'].includes(el.dataset.scheduleField)){s[el.dataset.scheduleField]=el.value.slice(0,el.dataset.scheduleField==='notes'?5000:400);save();resizeOne(el);}return;
    }
    if(el.dataset.availDay&&TASK_MEMBERS.includes(el.dataset.member)){
      const day=el.dataset.availDay,m=el.dataset.member;
      const row=state.availability[day]||(state.availability[day]={});if(el.value)row[m]=el.value.slice(0,400);else delete row[m];
      if(!Object.keys(row).length)delete state.availability[day];save();resizeOne(el);return;
    }
    if(el.dataset.meetingTitle){const m=state.meetings.find(x=>x.id===el.dataset.meetingTitle);if(m){m.title=el.value.slice(0,300);save();}return;}
    if(el.dataset.meetingRow){const m=state.meetings.find(x=>x.id===el.dataset.meetingRow),r=m?.rows.find(x=>x.id===el.dataset.rowId);if(r){r.text=el.value.slice(0,10000);save();resizeOne(el);}return;}
    if(el.dataset.input==='note'){const entry=slot('practice').entries.find(x=>x.id===el.dataset.id);if(entry){entry.note=el.value.slice(0,3000);save();}return;}
    if(el.id==='planned-minutes'){const num=Number(el.value);if(el.value!==''&&Number.isInteger(num)&&num>=0&&num<=999){slot(page==='practice'?'practice':'setlist').minutes=num;save();updateTime();}}
  });
  document.addEventListener('change',e=>{
    const el=e.target;
    if(el.dataset.taskField){const t=state.tasks.find(x=>x.id===el.closest('[data-task-id]')?.dataset.taskId),k=el.dataset.taskField;if(!t)return;
      if(k==='category'&&['',...TASK_CATEGORIES].includes(el.value))t[k]=el.value;
      if(k==='status'&&['',...TASK_STATUSES].includes(el.value))t[k]=el.value;
      if(k==='deadline'&&/^\d{4}-\d{2}-\d{2}$/.test(el.value))t[k]=el.value;
      save();render();return;}
    if(el.dataset.accountField){const a=state.accounting.find(x=>x.id===el.closest('[data-account-id]')?.dataset.accountId),k=el.dataset.accountField;if(!a)return;
      if(k==='type'&&['','income','expense'].includes(el.value))a[k]=el.value;
      if(k==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(el.value))a[k]=el.value;
      if(k==='member'&&['',...TASK_MEMBERS].includes(el.value))a[k]=el.value;
      save();if(k==='type'||k==='date')render();return;}
    if(el.dataset.detailDesc||el.dataset.detailTitle||el.dataset.detailOverall||el.dataset.detailFilename||el.dataset.detailCell){save();if(el.dataset.detailDesc)render();return;}

    if(el.dataset.scheduleField){const s=state.schedules.find(x=>x.id===el.closest('[data-schedule-id]')?.dataset.scheduleId);if(!s)return;
      const k=el.dataset.scheduleField;
      if(k==='category'&&['','practice','live','other'].includes(el.value))s.category=el.value;
      if(k==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(el.value))s.date=el.value;
      if((k==='start'||k==='end')&&(el.value===''||minutesOf(el.value)!==null&&minutesOf(el.value)%5===0))s[k]=el.value;
      save();if(['date','category'].includes(k))render();return;
    }
    
    if(el.dataset.select==='entry-minutes'){const entry=slot('practice').entries.find(x=>x.id===el.dataset.id);const n=Number(el.value);if(entry&&Number.isInteger(n)&&n>=5&&n<=240&&n%5===0){entry.minutes=n;save();updateTime();}return;}
    if(['practice-start','practice-end'].includes(el.id)){
      const n=minutesOf(el.value);if(n===null){el.value=slot('practice')[el.id==='practice-start'?'startTime':'endTime'];return;}
      slot('practice')[el.id==='practice-start'?'startTime':'endTime']=el.value;const label=document.getElementById(el.id+'-label');if(label)label.textContent=el.value;save();updateTime();return;
    }
    if(el.id==='planned-minutes'){el.value=slot('setlist').minutes;return;}
    if(el.id==='backup-input'){void readBackup(el.files?.[0]);el.value='';}
  });
  document.addEventListener('focusout',e=>{if(e.target.id==='planned-minutes')e.target.value=slot('setlist').minutes;setTimeout(flushRemote,0);});
  document.addEventListener('scroll',e=>{const box=e.target;if(box.id!=='avail-scroll'||!availabilityRange||availabilityRange.expanding)return;
    if(box.scrollTop<170)extendAvailability('past');else if(box.scrollTop+box.clientHeight>box.scrollHeight-450)extendAvailability('future');
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modalOpen)closeData();if(e.key==='Enter'&&e.target.id==='planned-minutes')e.target.blur();});
  // Prevent unintentional mobile double-tap / pinch zoom; scrolling and form editing remain enabled.
  document.addEventListener('dblclick',event=>{if(event.cancelable)event.preventDefault();},{passive:false});
  document.addEventListener('gesturestart',event=>{if(event.cancelable)event.preventDefault();},{passive:false});
  document.addEventListener('gesturechange',event=>{if(event.cancelable)event.preventDefault();},{passive:false});
  // Drag handles work with touch and mouse; prevents accidental scroll only during the drag.
  document.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('[data-handle]');if(!handle||!['setlist','practice'].includes(page)||e.button!==0)return;
    const row=handle.closest('[data-entry]');if(!row)return;
    dragging={id:row.dataset.entry,kind:page,pointerId:e.pointerId,fromY:e.clientY,target:null,started:false,handle};
    try{handle.setPointerCapture(e.pointerId);}catch(_){}
  });
  document.addEventListener('pointermove',e=>{
    if(!dragging||dragging.pointerId!==e.pointerId)return;
    if(!dragging.started&&Math.abs(e.clientY-dragging.fromY)<7)return;dragging.started=true;
    document.querySelectorAll('.drag-target,.drag-source').forEach(n=>n.classList.remove('drag-target','drag-source'));
    const rows=[...document.querySelectorAll('.column:first-child [data-entry]')];
    const source=rows.find(n=>n.dataset.entry===dragging.id);source?.classList.add('drag-source');
    let target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-entry]');
    if(!target||!rows.includes(target))target=rows.find(n=>e.clientY<n.getBoundingClientRect().bottom)||rows.at(-1);
    if(target&&target.dataset.entry!==dragging.id){dragging.target=target.dataset.entry;target.classList.add('drag-target');}
  });
  function pointerFinish(e){if(!dragging||dragging.pointerId!==e.pointerId)return;const d=dragging;dragging=null;try{d.handle.releasePointerCapture(e.pointerId);}catch(_){}document.querySelectorAll('.drag-target,.drag-source').forEach(n=>n.classList.remove('drag-target','drag-source'));if(d.started&&d.target)moveEntry(d.kind,d.id,d.target);}
  document.addEventListener('pointerup',pointerFinish);document.addEventListener('pointercancel',pointerFinish);
  render();
  if('serviceWorker' in navigator&&(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('オフライン設定:',e)));
  }
})();
