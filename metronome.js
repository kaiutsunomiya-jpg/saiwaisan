'use strict';
/* さいわいさん — テンポスイッチ組み込み版（音色固定、オフライン動作） */
(() => {
  const STORAGE_KEY = 'saiwai.metronome.v1';
  const ORIGINAL_KEY = 'tempo-switch-settings-v1';
  const LETTERS = ['A', 'B', 'C'];
  const MIN_BPM = 30, MAX_BPM = 300, MAX_STEPS = 256;
  const DEFAULT_PRESETS = {A:100, B:120, C:110};
  const DEFAULT_SEQUENCE = ['B','A','B','A','B','A','B','A','B','C'];
  const $ = (selector) => root?.querySelector(selector);
  const clone = value => JSON.parse(JSON.stringify(value));
  let root = null, undoHistory = [];
  let audioContext = null, clickBuffer = null, timer = null;
  let beatTime = 0, beatIndex = 0, clockId = 0, startId = 0;
  let wakeLock = null;
  const soundNodes = new Set(), visualTimers = new Set();

  function validated(data) {
    const presets = {};
    for (const l of LETTERS) {
      const value = data?.presets?.[l];
      presets[l] = Number.isInteger(value) && value >= MIN_BPM && value <= MAX_BPM ? value : DEFAULT_PRESETS[l];
    }
    const sequence = Array.isArray(data?.sequence)
      ? data.sequence.filter(l => LETTERS.includes(l)).slice(0, MAX_STEPS)
      : [...DEFAULT_SEQUENCE];
    return {presets, sequence, soundOn:data?.soundOn !== false};
  }
  function load() {
    try {
      // 元の「テンポスイッチ」と同じGitHub Pagesドメインなら、初回のみ設定を取り込みます。
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(ORIGINAL_KEY);
      if (raw) return validated(JSON.parse(raw));
    } catch (error) { console.warn('テンポ設定を読み込めません:',error); }
    return validated(null);
  }
  let state = {...load(), playing:false, currentIndex:-1};
  function save() {
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(snapshot())); }
    catch (error) { console.warn('テンポ設定を保存できません:',error); }
  }
  function snapshot(){ return clone({presets:state.presets,sequence:state.sequence,soundOn:state.soundOn}); }
  function importSettings(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.sequence)) throw Error('メトロノームの設定が不正です');
    stop();
    state = {...validated(data),playing:false,currentIndex:-1};
    undoHistory=[];save();updateUI();
  }

  function layout() {
    return `<div class="mt-app">
      <div class="mt-layout">
        <div class="mt-setup">
          <section class="mt-region mt-presets" aria-label="テンポ設定">
            <div class="mt-section-heading"><h2>テンポ</h2><small>30〜300 BPM</small></div>
            <div class="mt-tempo-grid">${LETTERS.map(l=>`<div class="mt-tempo-card mt-tone-${l}">
              <div class="mt-tempo-letter">${l}</div>
              <div class="mt-tempo-adjust">
                <button type="button" class="mt-adjust-btn" data-mt="adjust" data-letter="${l}" data-delta="-1" aria-label="${l}のテンポを1下げる">−</button>
                <label class="mt-tempo-value"><input id="mt-bpm-${l}" data-mt-bpm="${l}" type="number" min="30" max="300" step="1" inputmode="numeric" aria-label="${l}のBPM"><span>BPM</span></label>
                <button type="button" class="mt-adjust-btn" data-mt="adjust" data-letter="${l}" data-delta="1" aria-label="${l}のテンポを1上げる">＋</button>
              </div>
            </div>`).join('')}</div>
            <p class="mt-sound-note">全拍共通：硬く短いクリック音（音色固定）</p>
          </section>
          <section class="mt-region mt-sequence-region" aria-label="テンポのシーケンス">
            <div class="mt-section-heading"><h2>シーケンス</h2><small id="mt-seq-count">10 STEPS</small></div>
            <div class="mt-sequence-editor"><div class="mt-sequence-list" id="mt-seq-list" aria-label="テンポ切り替えの順番"></div></div>
            <div class="mt-sequence-toolbar">
              <div class="mt-add-buttons">${LETTERS.map(l=>`<button type="button" class="mt-add-btn mt-tone-${l}" data-mt="add" data-letter="${l}" aria-label="テンポ${l}を追加">＋${l}</button>`).join('')}</div>
              <div class="mt-edit-buttons"><button type="button" class="mt-minor-btn" data-mt="undo" id="mt-undo">↶ 戻す</button><button type="button" class="mt-minor-btn" data-mt="clear" id="mt-clear">全消去</button></div>
            </div>
            <p class="mt-hint">番号をタップすると削除。変更はこの端末に自動保存されます。</p>
          </section>
        </div>
        <section class="mt-region mt-live" aria-label="メトロノーム演奏">
          <div class="mt-section-heading"><h2>演奏</h2><span class="mt-status" id="mt-status"><i></i><span id="mt-status-text">停止中</span></span></div>
          <div class="mt-current-row">
            <div class="mt-current" id="mt-current"><div class="mt-current-main"><span id="mt-current-letter">—</span><strong id="mt-current-bpm">—</strong><small>BPM</small></div></div>
            <div class="mt-beat-panel"><div class="mt-beat-dots" id="mt-beat-dots"><i></i><i></i><i></i><i></i></div><span id="mt-progress">0 / 10</span></div>
          </div>
          <div class="mt-action-group">
            <div class="mt-next"><span>NEXT</span><strong id="mt-next-caption">B · 120 BPM</strong><em id="mt-wrap"></em></div>
            <button type="button" class="mt-action-button" id="mt-next-button" data-mt="next" data-letter="B"><span><strong id="mt-action-label">再生スタート</strong><small id="mt-action-detail">B · 120 BPM</small></span><b id="mt-action-arrow">▶</b></button>
          </div>
          <div class="mt-footer"><button type="button" class="mt-tool-button" id="mt-stop" data-mt="stop">■ 停止・先頭へ</button><button type="button" class="mt-tool-button" id="mt-sound" data-mt="sound" aria-pressed="true">♫ 音 ON</button></div>
          <div class="mt-sr-only" id="mt-announcement" role="status" aria-live="polite"></div>
        </section>
      </div>
    </div>`;
  }

  function updateUI(){
    if (!root) return;
    for (const l of LETTERS) {
      const input = $(`#mt-bpm-${l}`);
      if (input && input !== document.activeElement) input.value = String(state.presets[l]);
    }
    const list = $('#mt-seq-list');
    if (list) {
      const nextIdx = state.playing ? (state.currentIndex + 1) % state.sequence.length : 0;
      list.innerHTML = state.sequence.length ? state.sequence.map((l,i) =>
        `<button type="button" class="mt-seq-chip mt-tone-${l} ${state.playing && i===state.currentIndex?'is-current':i===nextIdx?'is-next':''}" data-mt="remove" data-index="${i}" title="${i+1}番目を削除" aria-label="${i+1}番目、${l}、${state.presets[l]} BPM。タップして削除"><small>${i+1}</small><strong>${l}</strong></button>`).join('')
        : '<p class="mt-empty">＋A・＋B・＋Cからテンポを追加してください</p>';
    }
    const count = state.sequence.length;
    const currentLetter = state.playing ? state.sequence[state.currentIndex] : null;
    const nextIndex = state.playing ? (state.currentIndex+1) % count : 0;
    const nextLetter = count ? state.sequence[nextIndex] : null;
    $('#mt-seq-count').textContent = `${count} STEPS`;
    $('#mt-undo').disabled = !undoHistory.length;
    $('#mt-clear').disabled = !count;
    $('#mt-status').classList.toggle('is-playing',state.playing);
    $('#mt-status-text').textContent = state.playing ? '再生中' : '停止中';
    $('#mt-current-letter').textContent = currentLetter || '—';
    $('#mt-current-bpm').textContent = currentLetter ? state.presets[currentLetter] : '—';
    $('#mt-current').dataset.letter = currentLetter || '';
    $('#mt-progress').textContent = `${state.playing?state.currentIndex+1:0} / ${count}`;
    $('#mt-next-caption').textContent = nextLetter ? `${nextLetter} · ${state.presets[nextLetter]} BPM` : '未設定';
    $('#mt-wrap').textContent = state.playing && nextIndex===0 ? '↺ 先頭へ' : '';
    const advance = $('#mt-next-button');
    advance.disabled = !count;
    advance.dataset.letter = nextLetter || '';
    $('#mt-action-label').textContent = !count ? 'テンポを追加してください' : state.playing ? '次のテンポへ' : '再生スタート';
    $('#mt-action-detail').textContent = nextLetter ? `${nextLetter} · ${state.presets[nextLetter]} BPM` : '＋A / ＋B / ＋C';
    $('#mt-action-arrow').textContent = state.playing ? '→' : '▶';
    $('#mt-stop').disabled = !state.playing;
    $('#mt-sound').textContent = state.soundOn ? '♫ 音 ON' : '♪ 音 OFF';
    $('#mt-sound').setAttribute('aria-pressed',String(state.soundOn));
    if(!state.playing)clearVisualDots();
  }

  function ensureAudio(){
    if(audioContext)return audioContext;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx)throw Error('このブラウザはWeb Audioに対応していません');
    audioContext = new Ctx();
    // 高いアタック、短い減衰 (約35 ms) の固定クリック音。外部ファイル不要。
    const rate = audioContext.sampleRate;
    const duration = 0.038;
    clickBuffer = audioContext.createBuffer(1,Math.ceil(rate*duration),rate);
    const channel = clickBuffer.getChannelData(0);
    let seed = 71821, phase = 0;
    for(let i=0;i<channel.length;i++){
      const t=i/rate;
      seed = (Math.imul(seed,1664525)+1013904223)>>>0;
      const noise = (seed / 4294967296)*2-1;
      phase += 2*Math.PI*(1630-420*(t/duration))/rate;
      const body = Math.sin(phase)*0.65;
      const high = noise*0.46;
      const envelope = Math.pow(1-t/duration,5) * Math.min(1,t*6000);
      channel[i] = Math.max(-1,Math.min(1,(body+high)*envelope*0.62));
    }
    return audioContext;
  }
  function queueClick(time){
    if(!state.soundOn||!audioContext||!clickBuffer)return;
    const src=audioContext.createBufferSource();
    const gain=audioContext.createGain();
    src.buffer=clickBuffer;
    gain.gain.setValueAtTime(0.94,time);
    src.connect(gain);gain.connect(audioContext.destination);
    const node={src,gain};soundNodes.add(node);
    src.onended=()=>{ soundNodes.delete(node);try{src.disconnect();gain.disconnect();}catch(_){} };
    src.start(time);
  }
  function killSounds(){
    if(!audioContext)return;
    const t=audioContext.currentTime;
    for(const node of [...soundNodes]){
      try{node.gain.gain.cancelScheduledValues(t);node.gain.gain.setValueAtTime(0,t);node.src.stop(t+0.002);}catch(_){}
      soundNodes.delete(node);
    }
  }
  function clearVisualDots(){ if(!root)return;$('#mt-beat-dots')?.querySelectorAll('i').forEach(dot=>dot.classList.remove('active')); }
  function clearVisuals(){ for(const id of visualTimers) clearTimeout(id);visualTimers.clear();clearVisualDots(); }
  function visualBeat(time,ordinal,id){
    const wait=Math.max(0,(time-audioContext.currentTime)*1000);
    const task=setTimeout(()=>{
      visualTimers.delete(task);
      if(!state.playing||id!==clockId||!root)return;
      const dot=$('#mt-beat-dots')?.children[ordinal];
      if(!dot)return;
      dot.classList.add('active');
      const off=setTimeout(()=>{visualTimers.delete(off);if(id===clockId)dot.classList.remove('active');},90);
      visualTimers.add(off);
    },wait);
    visualTimers.add(task);
  }
  function schedule(){
    if(!state.playing||!audioContext||audioContext.state!=='running')return;
    const l=state.sequence[state.currentIndex];if(!l)return;
    const interval=60/state.presets[l];
    const id=clockId;
    while(beatTime<audioContext.currentTime+0.085){
      const ordinal=beatIndex%4;
      queueClick(beatTime);
      visualBeat(beatTime,ordinal,id);
      beatTime+=interval;beatIndex++;
    }
  }
  function resetClock(){
    clearInterval(timer);timer=null;clockId++;
    clearVisuals();killSounds();
    if(!state.playing||!audioContext||audioContext.state!=='running')return;
    beatTime=audioContext.currentTime+0.015;beatIndex=0;
    schedule();timer=setInterval(schedule,25);
  }
  async function requestWake(){
    try{ if(!navigator.wakeLock?.request)return;wakeLock=await navigator.wakeLock.request('screen'); }catch(_){}
  }
  function releaseWake(){if(wakeLock){try{void wakeLock.release();}catch(_){}wakeLock=null;}}
  function announce(message){if($('#mt-announcement'))$('#mt-announcement').textContent=message;}
  function stop(){
    ++startId;state.playing=false;state.currentIndex=-1;
    resetClock();releaseWake();updateUI();
  }
  function next(){
    if(!state.sequence.length)return;
    state.currentIndex=state.playing?(state.currentIndex+1)%state.sequence.length:0;
    state.playing=true;updateUI();
    const l=state.sequence[state.currentIndex];
    announce(`${l}、${state.presets[l]} BPM、${state.currentIndex+1}番目`);
    void requestWake();
    const request=++startId;
    try{
      const ctx=ensureAudio();
      if(ctx.state==='running'){resetClock();return;}
      void ctx.resume().then(()=>{if(request===startId&&state.playing)resetClock();})
        .catch(()=>{if(request===startId){stop();announce('音声を再生できません。iPhoneの音量と音声設定を確認してください。');}});
    }catch(_){stop();announce('このブラウザでは音声を再生できません。');}
  }
  function updatePreset(l,n){
    if(!LETTERS.includes(l)||!Number.isInteger(n)||n<MIN_BPM||n>MAX_BPM)return false;
    if(state.presets[l]===n)return true;
    state.presets[l]=n;save();updateUI();
    if(state.playing&&state.sequence[state.currentIndex]===l)resetClock();
    return true;
  }
  function sequenceChange(nextSequence){
    if(nextSequence.length>MAX_STEPS){announce(`最大${MAX_STEPS}ステップです`);return;}
    undoHistory.push([...state.sequence]);if(undoHistory.length>40)undoHistory.shift();
    if(state.playing)stop();
    state.sequence=nextSequence;save();updateUI();
  }
  function onClick(event){
    const btn=event.target.closest('[data-mt]');
    if(!btn||!root?.contains(btn)||btn.disabled)return;
    const action=btn.dataset.mt,l=btn.dataset.letter;
    switch(action){
      case 'adjust':updatePreset(l,Math.max(MIN_BPM,Math.min(MAX_BPM,state.presets[l]+Number(btn.dataset.delta))));break;
      case 'add':sequenceChange([...state.sequence,l]);break;
      case 'remove':sequenceChange(state.sequence.filter((_,i)=>i!==Number(btn.dataset.index)));break;
      case 'clear':if(state.sequence.length)sequenceChange([]);break;
      case 'undo':if(undoHistory.length){if(state.playing)stop();state.sequence=undoHistory.pop();save();updateUI();}break;
      case 'next':next();break;
      case 'stop':stop();break;
      case 'sound':state.soundOn=!state.soundOn;if(!state.soundOn)killSounds();save();updateUI();break;
    }
  }
  function onChange(event){
    const l=event.target.dataset.mtBpm;if(!l)return;
    const n=Number(event.target.value);
    if(!updatePreset(l,n))announce('BPMは30〜300の整数で入力してください。');
    event.target.value=String(state.presets[l]);
  }
  function onBlur(event){const l=event.target.dataset.mtBpm;if(l)event.target.value=String(state.presets[l]);}
  function onKeydown(event){
    if(!root||event.repeat||!['Space','Escape'].includes(event.code))return;
    if(event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT','TEXTAREA','BUTTON','SELECT'].includes(event.target.tagName)))return;
    event.preventDefault();if(event.code==='Space')next();else if(state.playing)stop();
  }
  function onVisibility(){ if(document.hidden && state.playing)stop(); }
  function mount(element){
    if(!element)return;
    if(root&&root!==element)unmount();
    root=element;
    root.innerHTML=layout();
    root.addEventListener('click',onClick);
    root.addEventListener('change',onChange);
    root.addEventListener('focusout',onBlur);
    root.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.dataset.mtBpm)event.target.blur();});
    document.addEventListener('keydown',onKeydown);
    document.addEventListener('visibilitychange',onVisibility);
    updateUI();
  }
  function unmount(){
    if(!root)return;
    stop();root.removeEventListener('click',onClick);
    root.removeEventListener('change',onChange);root.removeEventListener('focusout',onBlur);
    document.removeEventListener('keydown',onKeydown);
    document.removeEventListener('visibilitychange',onVisibility);
    root=null;
  }
  window.SaiwaiMetronome={mount,unmount,snapshot,importSettings};
})();
