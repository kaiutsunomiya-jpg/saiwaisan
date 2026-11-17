'use strict';
/* さいわいさん PWA — オリジナル SwiftUI 版のデータと操作を移植 */
(() => {
  const STORAGE_KEY = 'saiwai.pwa.state.v1';
  const INTERLUDES = ['-----tuning-----', '-----MC-----', '-----ミニMC-----', '（イントロ追加）'];
  const $app = document.querySelector('#app');
  const $modals = document.querySelector('#modal-root');
  const $toast = document.querySelector('#toast');
  const icons = {
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    bird: '<path d="M16 7c-3-4-9-2-10 3-1 3 1 7 4 8 5 2 10-2 10-7 0-2-1-4-4-4Z"/><path d="m19 11 4-1-4-2M6 14c-2 2-3 4-3 6M10 19l-1 3M14 19l1 3"/><circle cx="17" cy="9" r=".65" fill="currentColor"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    save: '<path d="M5 3h12l4 4v14H3V3h2Z"/><path d="M7 3v7h9V3M7 21v-8h10v8M10 5v3"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.list}</svg>`;
  const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const cloned = obj => JSON.parse(JSON.stringify(obj));
  const uid = () => (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const formatTime = sec => `${sec < 0 ? '−' : ''}${Math.floor(Math.abs(sec) / 60)}:${String(Math.abs(sec) % 60).padStart(2, '0')}`;
  const isInterlude = song => song && song.tuning === '' && song.capo === null && song.bpm === null && INTERLUDES.includes(song.title);
  const metadata = song => [song.capo !== null ? `Capo${song.capo}` : null, formatTime(song.durationSeconds), song.bpm !== null ? `${song.bpm} BPM` : null].filter(Boolean).join(' · ');
  const usedSeconds = () => state.draft.reduce((acc, entry) => acc + entry.song.durationSeconds, 0);
  const remainingSeconds = () => state.allottedMinutes * 60 - usedSeconds();
  const currentSaved = () => state.savedSets.find(item => item.id === state.editingSetlistID);
  const pageTitle = () => currentSaved()?.name || '新規セットリスト';
  const newState = () => ({songs: cloned(INITIAL_SONGS), draft: [], savedSets: [], allottedMinutes:30, editingSetlistID:null});
  let state = newState(), activeTab = 'setlist', activeModal = null, editingSongId = null;
  let toastTimer, positions = {draft:0, picker:0, library:0}, currentDrag = null;

  function cleanSong(s) {
    if (!s || typeof s !== 'object' || typeof s.title !== 'string' || !Number.isInteger(s.durationSeconds) || s.durationSeconds < 0 || s.durationSeconds > 99999) throw Error('曲データが不正です');
    const capo = s.capo === null ? null : Number(s.capo);
    const bpm = s.bpm === null ? null : Number(s.bpm);
    if (capo !== null && (!Number.isInteger(capo) || capo < 0 || capo > 10)) throw Error('Capoの値が不正です');
    if (bpm !== null && (!Number.isInteger(bpm) || bpm < 1 || bpm > 400)) throw Error('BPMの値が不正です');
    return {id:typeof s.id === 'string' && s.id.length < 100 ? s.id : uid(),title:s.title.slice(0,200),tuning:typeof s.tuning==='string'?s.tuning.slice(0,40):'Reg.',capo,durationSeconds:s.durationSeconds,bpm};
  }
  function validateState(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.songs) || !Array.isArray(raw.draft) || !Array.isArray(raw.savedSets)) throw Error('バックアップ形式が異なります');
    if (raw.songs.length > 2000 || raw.draft.length > 2000 || raw.savedSets.length > 1000) throw Error('データ件数が多すぎます');
    const entry = e => ({id:typeof e?.id === 'string' ? e.id.slice(0,100) : uid(),song:cleanSong(e?.song)});
    const savedSets = raw.savedSets.map(saved => {
      if (!saved || typeof saved.name !== 'string' || !Array.isArray(saved.entries) || saved.entries.length > 2000) throw Error('セットリスト形式が不正です');
      return {id:typeof saved.id === 'string' ? saved.id.slice(0,100) : uid(),name:saved.name.slice(0,200),allottedMinutes:Number.isInteger(saved.allottedMinutes) ? Math.max(0,Math.min(999,saved.allottedMinutes)):30,entries:saved.entries.map(entry),savedAt:typeof saved.savedAt === 'string' ? saved.savedAt : new Date().toISOString()};
    });
    const minute = Number.isInteger(raw.allottedMinutes) && raw.allottedMinutes >= 0 && raw.allottedMinutes <= 999 ? raw.allottedMinutes : 30;
    const editingId = typeof raw.editingSetlistID === 'string' && savedSets.some(x=>x.id===raw.editingSetlistID) ? raw.editingSetlistID : null;
    return {songs:raw.songs.map(cleanSong), draft:raw.draft.map(entry), savedSets, allottedMinutes:minute, editingSetlistID:editingId};
  }
  function loadState() {
    try { const value = localStorage.getItem(STORAGE_KEY); return value ? validateState(JSON.parse(value)) : newState(); }
    catch (e) { console.warn('保存データを読み込めません',e); return newState(); }
  }
  function persist() {
    try {localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}
    catch (e) {console.error(e); notice('保存できません。端末のストレージ設定を確認してください');return false;}
  }
  function notice(message) { $toast.textContent = message; $toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>$toast.classList.remove('visible'),2500); }
  function songsIn(group) {
    return state.songs.map((song,index)=>({song,index})).filter(x=> group === '曲' ? !isInterlude(x.song) : isInterlude(x.song))
      .sort((a,b) => group === 'MCなど' ? INTERLUDES.indexOf(a.song.title)-INTERLUDES.indexOf(b.song.title) : ((a.song.capo ?? 999)-(b.song.capo ?? 999) || a.index-b.index)).map(x=>x.song);
  }
  function recordScrolls() {
    for(const kind of ['draft','picker','library']) { const elem=document.querySelector(`[data-scroll="${kind}"]`); if(elem) positions[kind]=elem.scrollTop; }
  }
  function restoreScrolls() {
    for(const kind of ['draft','picker','library']) { const elem=document.querySelector(`[data-scroll="${kind}"]`); if(elem) elem.scrollTop=positions[kind]; }
  }
  function topbar() {
    const title = activeTab === 'setlist' ? pageTitle() : (activeTab === 'library' ? '持ち曲' : '文鳥');
    let left = '', right = '';
    if(activeTab === 'setlist') {
      left = '<button class="new-button" data-action="new" title="新規セットリスト">新規</button>';
      right = `<button data-action="save" title="セットリストを保存" aria-label="セットリストを保存">${icon('save')}</button><button data-action="copy" title="コピー" aria-label="コピー" ${state.draft.length?'':'disabled'}>${icon('copy')}</button><button data-action="saved" title="保存済みセットリスト" aria-label="保存済みセットリスト">${icon('folder')}</button>`;
    } else if(activeTab === 'library') {
      right = `<button data-action="add-song" title="持ち曲を追加" aria-label="持ち曲を追加">${icon('plus')}</button>`;
    }
    return `<header class="topbar"><div class="topbar-side">${left}</div><div class="topbar-title" title="${esc(title)}">${esc(title)}</div><div class="topbar-side right">${right}</div></header>`;
  }
  function timebar() {
    const remain = remainingSeconds();
    return `<div class="time-bar"><strong id="remaining-label" class="time-left ${remain<0?'over':''}">残り ${formatTime(remain)}</strong><span class="spacer"></span><label class="time-label" for="minutes">持ち時間</label><input class="minutes-input" aria-label="持ち時間（分）" id="minutes" type="number" inputmode="numeric" min="0" max="999" value="${state.allottedMinutes}"><span class="time-unit">分</span></div>`;
  }
  function draftRow(entry) {
    const other = isInterlude(entry.song);
    return `<div class="song-row draft-row ${other?'other':''}" data-entry-id="${esc(entry.id)}"><div class="draft-head"><button class="row-mini drag-handle" title="長押ししてドラッグで並べ替え" aria-label="${esc(entry.song.title)} をドラッグして並べ替え">⠿</button><div class="draft-title">${esc(entry.song.title)}</div><button class="row-mini remove" data-action="remove-entry" data-id="${esc(entry.id)}" aria-label="${esc(entry.song.title)} を削除">×</button></div><div class="library-row-meta">${esc(metadata(entry.song))}</div></div>`;
  }
  function pickerRow(song) {
    const other = isInterlude(song);
    return `<div class="song-row ${other?'other':''}"><button class="library-row" data-action="pick-song" data-id="${esc(song.id)}" aria-label="${esc(song.title)} を追加"><div class="library-row-title"><span>${esc(song.title)}</span><span class="plus" aria-hidden="true">⊕</span></div><div class="library-row-meta">${esc(metadata(song))}</div></button></div>`;
  }
  function setlistPage() {
    return `${timebar()}<div class="columns"><section class="col"><div class="col-label">SETLIST</div><div class="col-scroll" data-scroll="draft" aria-label="セットリスト、ドラッグで並べ替え">${state.draft.length? state.draft.map(draftRow).join('') : '<p class="empty-col">右側の曲をタップして追加</p>'}</div></section><div class="v-divider"></div><section class="col"><div class="col-label">持ち曲（タップで追加）</div><div class="col-scroll" data-scroll="picker" aria-label="持ち曲一覧">${['曲','MCなど'].map(group=>`<div class="song-group-title">${group}</div>${songsIn(group).map(pickerRow).join('')}`).join('')}</div></section></div>`;
  }
  function songLibraryPage() {
    return `<div class="library-page" data-scroll="library">${['曲','MCなど'].map(group=>`<section><h2>${group}</h2>${songsIn(group).map(song=>{
      const other = isInterlude(song);
      const body = `<span class="title">${esc(song.title)}</span><span class="sub">${esc(metadata(song))}</span>`;
      return other?`<div class="library-page-row other">${body}</div>`:`<button class="library-page-row" data-action="edit-song" data-id="${esc(song.id)}" aria-label="${esc(song.title)} を編集">${body}</button>`;
    }).join('')}</section>`).join('')}</div>`;
  }
  function bunchoPage() {return `<div class="buncho-page"><img src="./assets/buncho.jpg" alt="ケージに並んでとまっている2羽の文鳥の写真"></div>`;}
  function tabs() {
    return `<nav class="bottom-tabs" aria-label="ページ切り替え">${[['setlist','list','セットリスト'],['library','music','持ち曲'],['buncho','bird','文鳥']].map(([key,ico,label])=>`<button class="tab-btn ${key===activeTab?'active':''}" data-action="tab" data-tab="${key}" ${key===activeTab?'aria-current="page"':''}>${icon(ico)}<span>${label}</span></button>`).join('')}</nav>`;
  }
  function render() {
    recordScrolls();
    $app.innerHTML = `${topbar()}<main class="tab-content">${activeTab==='setlist'?setlistPage():activeTab==='library'?songLibraryPage():bunchoPage()}</main>${tabs()}`;
    restoreScrolls();
    document.title = `さいわいさん${activeTab==='setlist' ? ' - '+pageTitle():''}`;
  }
  function refreshRemaining() {
    const el=document.querySelector('#remaining-label');if(!el)return;
    const remain=remainingSeconds();el.textContent=`残り ${formatTime(remain)}`;el.classList.toggle('over',remain<0);
  }
  function sheet(title,content,submitLabel='',type='') {
    return `<div class="backdrop" data-action="close-if-backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-header"><button data-action="close-modal">キャンセル</button><div class="sheet-title">${esc(title)}</div>${submitLabel?`<button type="submit" class="affirmative" form="${type}-form" data-submit="${type}">${esc(submitLabel)}</button>`:'<button data-action="close-modal">閉じる</button>'}</div><div class="sheet-content">${content}</div></section></div>`;
  }
  function closeModal() {$modals.innerHTML='';activeModal=null; editingSongId=null;}
  function showSave() {
    activeModal='save';
    const editable=!!currentSaved();
    const content = `<form id="save-form" data-form="save"><div class="form-section-title">セットリスト名</div><div class="form-group"><div class="field"><input aria-label="セットリスト名" name="name" id="save-name" type="text" placeholder="例：10/12 吉祥寺大移動" maxlength="200" required value="${esc(currentSaved()?.name || '')}" style="text-align:left"></div>${editable?'<label class="field"><span class="field-label">別のセットリストとして保存</span><input name="copy" type="checkbox"></label>':''}</div><div class="form-section-title">保存する内容</div><div class="form-group form-stats">持ち時間：${state.allottedMinutes}分<br>項目数：${state.draft.length}<br>使用時間：${formatTime(usedSeconds())}</div></form>`;
    $modals.innerHTML=sheet('セットリストを保存',content, editable?'上書き保存':'保存','save');
    const field=$modals.querySelector('#save-name');field.focus();field.setSelectionRange(field.value.length,field.value.length);updateSaveButton();
  }
  function updateSaveButton() {const btn=$modals.querySelector('[data-submit="save"]');if(!btn)return;btn.disabled=!$modals.querySelector('#save-name')?.value.trim();btn.textContent=currentSaved()&&!$modals.querySelector('[name="copy"]')?.checked?'上書き保存':'保存';}
  function showSaved() {
    activeModal='saved';
    const list=state.savedSets.length?state.savedSets.map(saved=>`<div class="saved-item"><button class="saved-open" data-action="restore-saved" data-id="${esc(saved.id)}"><div class="saved-name">${esc(saved.name)}</div><div class="saved-meta">${saved.allottedMinutes}分枠 · ${saved.entries.length}項目 · 使用 ${formatTime(saved.entries.reduce((n,e)=>n+e.song.durationSeconds,0))}</div></button><button class="saved-delete" data-action="delete-saved" data-id="${esc(saved.id)}" aria-label="${esc(saved.name)} を削除">${icon('trash')}</button></div>`).join(''):'<p class="empty-saved">保存済みのセットリストはありません</p>';
    const body=`${list}<div class="action-bar"><button data-action="export">${icon('download')} バックアップ</button><button data-action="import">バックアップ読込</button></div><p class="sheet-note">データはこの端末のブラウザ内に保存されます。端末変更やデータ消去に備えて、バックアップを保存できます。</p><input id="backup-file" type="file" accept="application/json,.json" hidden>`;
    $modals.innerHTML=sheet('保存済みセットリスト',body);
  }
  function rangeOptions(min,max,selected,suffix) {return Array.from({length:max-min+1},(_,i)=>{const v=i+min;return `<option value="${v}" ${v===selected?'selected':''}>${v}${suffix}</option>`;}).join('');}
  function showEditor(songId=null) {
    const song=songId ? state.songs.find(x=>x.id===songId) : null;
    if(songId&&!song){notice('曲が見つかりません');return;}
    activeModal='editor'; editingSongId=songId;
    const content=`<form id="editor-form" data-form="editor"><div class="form-section-title">必須項目</div><div class="form-group"><label class="field"><span class="field-label">曲名</span><input name="title" type="text" maxlength="200" placeholder="曲名" value="${esc(song?.title||'')}" required></label><div class="field"><span class="field-label">演奏時間</span><span class="duration-controls"><select name="minutes" aria-label="演奏時間の分">${rangeOptions(0,120,Math.floor((song?.durationSeconds||0)/60),'分')}</select><select name="seconds" aria-label="演奏時間の秒">${rangeOptions(0,59,(song?.durationSeconds||0)%60,'秒')}</select></span></div><label class="field"><span class="field-label">Capo数</span><select name="capo" aria-label="Capo数">${rangeOptions(0,10,song?.capo??0,'')}</select></label><label class="field"><span class="field-label">テンポ（BPM）</span><input name="bpm" type="number" inputmode="numeric" min="1" max="400" placeholder="例：128" value="${song?.bpm??''}" required></label></div></form>`;
    $modals.innerHTML=sheet(song?'持ち曲を編集':'持ち曲を追加',content,'確定','editor');
    updateEditorButton();
  }
  function editorFields(){const form=$modals.querySelector('#editor-form');if(!form)return null;return Object.fromEntries(new FormData(form));}
  function updateEditorButton() {
    const field=editorFields(), button=$modals.querySelector('[data-submit="editor"]');if(!field||!button)return;
    const length=(Number(field.minutes)*60+Number(field.seconds)); const tempo=Number(field.bpm);
    button.disabled = !(field.title.trim() && length>0 && length<=7259 && Number.isInteger(tempo) && tempo>=1 && tempo<=400);
  }
  function saveForm() {
    const name=$modals.querySelector('#save-name')?.value.trim();if(!name)return;
    const copy=!!$modals.querySelector('[name="copy"]')?.checked;
    const id=copy?uid():(state.editingSetlistID||uid());
    const saved={id,name,allottedMinutes:state.allottedMinutes,entries:cloned(state.draft),savedAt:new Date().toISOString()};
    state.savedSets=state.savedSets.filter(s=>s.id!==id);state.savedSets.unshift(saved);state.editingSetlistID=id;
    persist();closeModal();render();notice('セットリストを保存しました');
  }
  function editorForm() {
    const f=editorFields();if(!f)return;
    const title=f.title.trim(),duration=Number(f.minutes)*60+Number(f.seconds),capo=Number(f.capo),bpm=Number(f.bpm);
    if(!title||!Number.isInteger(duration)||duration<=0||duration>7259||!Number.isInteger(capo)||capo<0||capo>10||!Number.isInteger(bpm)||bpm<1||bpm>400)return;
    const song={id:editingSongId||uid(),title,tuning:'Reg.',capo,durationSeconds:duration,bpm};
    const idx=state.songs.findIndex(s=>s.id===song.id);
    if(idx===-1)state.songs.push(song);else state.songs[idx]=song;
    persist();closeModal();render();notice(idx===-1?'持ち曲を追加しました':'持ち曲を更新しました');
  }
  function copiedLine(song) {
    if(isInterlude(song))return song.title;
    return [song.title, song.capo!==null?`Capo${song.capo}`:'Capo未設定', song.tuning||'チューニング未設定', song.bpm!==null?String(song.bpm):'テンポ未設定',formatTime(song.durationSeconds)].join('　');
  }
  function clipboardText(){let count=0;const lines=state.draft.map(entry=>isInterlude(entry.song)?copiedLine(entry.song):`${++count} ${copiedLine(entry.song)}`);return ['＝＝＝＝＝＝＝',pageTitle(),''].concat(lines,['＝＝＝＝＝＝＝']).join('\n');}
  async function copyToClipboard() {
    if(!state.draft.length)return;
    const text=clipboardText();
    try {if(navigator.clipboard && window.isSecureContext)await navigator.clipboard.writeText(text);else throw Error('fallback');notice('コピーしました。メモなどに貼り付けられます');}
    catch(e){
      const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;opacity:0;left:0;top:0';document.body.append(area);area.focus();area.select();area.setSelectionRange(0,area.value.length);
      const ok=document.execCommand('copy');area.remove();notice(ok?'コピーしました':'コピーできません。Safariで開いてください');
    }
  }
  function exportData() {
    const dump={app:'SaiwaiSan_PWA',version:1,exportedAt:new Date().toISOString(),state};
    const blob=new Blob([JSON.stringify(dump,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`saiwai-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);notice('バックアップを保存しました');
  }
  async function importData(file) {
    if(!file)return;
    if(file.size>10*1024*1024){notice('10MB以下のJSONファイルを指定してください');return;}
    try {
      const content=JSON.parse(await file.text());
      if(content.app && content.app!=='SaiwaiSan_PWA')throw Error('さいわいさん用のバックアップではありません');
      const data=validateState(content.state||content);
      if(!window.confirm('現在の曲・セットリストをバックアップの内容で置き換えますか？\n現在のデータを残す場合は先にバックアップしてください。'))return;
      state=data;positions={draft:0,picker:0,library:0};persist();closeModal();render();notice('バックアップを読み込みました');
    }catch(e){console.error(e);window.alert(`バックアップを読み込めません：${e.message}`);}
  }
  function newSetlist() {
    if(state.draft.length && !window.confirm('新規セットリストを作成しますか？\n未保存の編集内容は破棄されます。保存済みデータは残ります。'))return;
    state.editingSetlistID=null;state.draft=[];positions.draft=0;persist();render();
  }
  function handleAction(button) {
    const action=button.dataset.action, id=button.dataset.id;
    switch(action) {
      case 'tab': activeTab=button.dataset.tab;render();break;
      case 'new':newSetlist();break;
      case 'save':showSave();break;
      case 'copy':void copyToClipboard();break;
      case 'saved':showSaved();break;
      case 'add-song':showEditor();break;
      case 'edit-song':showEditor(id);break;
      case 'pick-song':{const song=state.songs.find(s=>s.id===id);if(!song)return;state.draft.push({id:uid(),song:cloned(song)});persist();render();break;}
      case 'remove-entry':state.draft=state.draft.filter(e=>e.id!==id);persist();render();break;
      case 'close-modal':closeModal();break;
      case 'restore-saved':{const saved=state.savedSets.find(s=>s.id===id);if(!saved)return;state.editingSetlistID=saved.id;state.allottedMinutes=saved.allottedMinutes;state.draft=cloned(saved.entries);positions.draft=0;persist();closeModal();activeTab='setlist';render();notice('セットリストを開きました');break;}
      case 'delete-saved':{const saved=state.savedSets.find(s=>s.id===id);if(!saved)return;if(!window.confirm(`「${saved.name}」を削除しますか？\n現在編集中の内容は残ります。`))return;state.savedSets=state.savedSets.filter(s=>s.id!==id);if(state.editingSetlistID===id)state.editingSetlistID=null;persist();showSaved();render();notice('削除しました');break;}
      case 'export':exportData();break;
      case 'import':$modals.querySelector('#backup-file')?.click();break;
      case 'close-if-backdrop':if(button.classList.contains('backdrop'))closeModal();break;
    }
  }
  $app.addEventListener('click', e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)handleAction(b);});
  $modals.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;if(b.dataset.action==='close-if-backdrop'&&e.target!==b)return;handleAction(b);});
  $modals.addEventListener('submit',e=>{e.preventDefault();const form=e.target.dataset.form;if(form==='save')saveForm();if(form==='editor')editorForm();});
  $modals.addEventListener('input',e=>{if(activeModal==='save')updateSaveButton();if(activeModal==='editor')updateEditorButton();});
  $modals.addEventListener('change',e=>{if(e.target.id==='backup-file'){void importData(e.target.files?.[0]);}else if(activeModal==='save')updateSaveButton();else if(activeModal==='editor')updateEditorButton();});
  $app.addEventListener('input',e=>{if(e.target.id!=='minutes')return;const val=Number(e.target.value);if(e.target.value!=='' && Number.isInteger(val)&&val>=0&&val<=999){state.allottedMinutes=val;persist();refreshRemaining();}});
  $app.addEventListener('change',e=>{if(e.target.id==='minutes'){e.target.value=String(state.allottedMinutes);refreshRemaining();}});
  $app.addEventListener('focusout',e=>{if(e.target.id==='minutes')e.target.value=String(state.allottedMinutes);});
  $app.addEventListener('keydown',e=>{if(e.target.id==='minutes'&&e.key==='Enter')e.target.blur();});

  // Pointer Events は iPhone のタッチ操作でも動作。持ち手⠿をドラッグして順序変更。
  $app.addEventListener('pointerdown', e => {
    const handle=e.target.closest('.drag-handle');if(!handle||e.button!==0||activeTab!=='setlist')return;
    const row=handle.closest('[data-entry-id]');if(!row)return;
    currentDrag={pointerId:e.pointerId,sourceId:row.dataset.entryId,startY:e.clientY,targetId:null,moved:false,handle};
    try{handle.setPointerCapture(e.pointerId);}catch(_){}
  });
  $app.addEventListener('pointermove', e=>{
    if(!currentDrag||e.pointerId!==currentDrag.pointerId)return;
    if(!currentDrag.moved&&Math.abs(e.clientY-currentDrag.startY)<8)return;
    currentDrag.moved=true;
    const source=document.querySelector(`[data-entry-id="${CSS.escape(currentDrag.sourceId)}"]`);
    if(source)source.classList.add('dragging');
    document.querySelectorAll('.drop-target').forEach(row=>row.classList.remove('drop-target'));
    const col=$app.querySelector('[data-scroll="draft"]');
    let target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-entry-id]');
    if(!target && col) {
      const rows=[...col.querySelectorAll('[data-entry-id]')];
      target=rows.find(row=>e.clientY<=row.getBoundingClientRect().bottom) || rows.at(-1);
    }
    if(target&&target.dataset.entryId!==currentDrag.sourceId){currentDrag.targetId=target.dataset.entryId;target.classList.add('drop-target');}
  });
  function endDrag(e){
    if(!currentDrag||e.pointerId!==currentDrag.pointerId)return;
    const drag=currentDrag;currentDrag=null;
    if(drag.handle.hasPointerCapture?.(e.pointerId))try{drag.handle.releasePointerCapture(e.pointerId);}catch(_){}
    document.querySelectorAll('.dragging,.drop-target').forEach(row=>row.classList.remove('dragging','drop-target'));
    if(!drag.moved||!drag.targetId)return;
    const from=state.draft.findIndex(x=>x.id===drag.sourceId), to=state.draft.findIndex(x=>x.id===drag.targetId);
    if(from<0||to<0||from===to)return;
    const [entry]=state.draft.splice(from,1);state.draft.splice(to,0,entry);persist();render();
  }
  $app.addEventListener('pointerup',endDrag);$app.addEventListener('pointercancel',endDrag);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeModal)closeModal();});
  state=loadState();render();
  if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')) {
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('オフライン登録に失敗',err)));
  }
})();
