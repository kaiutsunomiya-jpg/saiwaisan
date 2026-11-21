'use strict';
/* テンポスイッチ：全拍同一の短く硬いクリック音、音色変更なし。 */
(() => {
  const KEY='saiwaisan.test.metro.v1';
  const PRESETS={A:100,B:120,C:110};
  const SEQ=['B','A','B','A','B','A','B','A','B','C'];
  const abc=['A','B','C'];
  const safe=v=>Number.isInteger(v)&&v>=30&&v<=300;
  const defaults=()=>({presets:{...PRESETS},sequence:[...SEQ],soundOn:true});
  const clean=obj=>({presets:Object.fromEntries(abc.map(l=>[l,safe(obj?.presets?.[l])?obj.presets[l]:PRESETS[l]])),
    sequence:Array.isArray(obj?.sequence)?obj.sequence.filter(x=>abc.includes(x)).slice(0,256):[...SEQ],soundOn:obj?.soundOn!==false});
  const copy=obj=>JSON.parse(JSON.stringify(obj));
  function load(){try{const raw=localStorage.getItem(KEY);return raw?clean(JSON.parse(raw)):defaults();}catch(_){return defaults();}}
  let config=load(), root=null, playing=false, index=-1;
  let context=null,buffer=null,interval=null,when=0,beat=0,version=0;
  let undo=[];
  const pending=new Set(),timerIds=new Set();
  const sel=q=>root?.querySelector(q);
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(config));}catch(e){console.warn(e);}};
  function markup(){return `<div class="metro"><div class="metro-columns"><div class="metro-left">
    <section class="metro-card"><div class="metro-presets">
    ${abc.map(l=>`<div class="metro-preset tone-${l}"><strong>${l}</strong><div class="metro-adjust"><button data-metro="adjust" data-letter="${l}" data-delta="-1" aria-label="${l}のBPMを下げる">−</button><label><input type="number" data-bpm="${l}" inputmode="numeric" min="30" max="300" aria-label="${l}のBPM"><small>BPM</small></label><button data-metro="adjust" data-letter="${l}" data-delta="1" aria-label="${l}のBPMを上げる">＋</button></div></div>`).join('')}
    </div></section>
    <section class="metro-card metro-sequence"><div class="metro-seq" id="metro-steps"></div><div class="metro-tools"><div>${abc.map(l=>`<button class="metro-add tone-${l}" data-metro="append" data-letter="${l}">＋${l}</button>`).join('')}</div><div><button data-metro="undo" id="metro-undo">↶ 戻す</button><button data-metro="clear" id="metro-clear">全消去</button></div></div></section>
    </div><section class="metro-card metro-player"><span id="metro-status" class="metro-status" style="display:none">停止中</span>
      <div class="metro-current"><div><span id="metro-letter">—</span><strong id="metro-bpm">—</strong><small>BPM</small></div><div class="metro-dots" id="metro-dots"><i></i><i></i><i></i><i></i></div></div>
      <div class="metro-next"><small>NEXT</small><strong id="metro-next">B · 120 BPM</strong><span id="metro-progress" style="display:none"></span></div>
      <button class="metro-main" id="metro-advance" data-metro="next"><span><b id="metro-main-text">再生スタート</b><small id="metro-main-sub">B · 120 BPM</small></span><span>▶</span></button>
      <div class="metro-footer"><button id="metro-stop" data-metro="stop">■ 停止・先頭へ</button><button id="metro-sound" data-metro="sound">♫ 音 ON</button></div><span id="metro-announcement" class="sr-only" aria-live="polite"></span>
    </section></div></div>`;}
  function show(){if(!root)return;abc.forEach(l=>{const el=sel(`[data-bpm="${l}"]`);if(el&&document.activeElement!==el)el.value=config.presets[l];});
    const count=config.sequence.length,ni=playing?((index+1)%count):0,nl=count?config.sequence[ni]:null;

    sel('#metro-steps').innerHTML=count?config.sequence.map((letter,i)=>`<button class="metro-step tone-${letter} ${playing&&i===index?'current':i===ni?'next':''}" data-metro="remove" data-index="${i}" title="${i+1}番目の${letter}を削除"><small>${i+1}</small><strong>${letter}</strong></button>`).join(''):'<span class="metro-empty">—</span>';
    sel('#metro-undo').disabled=!undo.length;sel('#metro-clear').disabled=!count;
    sel('#metro-status').textContent=playing?'再生中':'停止中';sel('#metro-status').classList.toggle('playing',playing);
    const letter=playing?config.sequence[index]:null;
    sel('#metro-letter').textContent=letter||'—';sel('#metro-bpm').textContent=letter?config.presets[letter]:'—';
    sel('#metro-progress').textContent=`${playing?index+1:0} / ${count}`;
    sel('#metro-next').textContent=nl?`${nl} · ${config.presets[nl]} BPM`:'';
    sel('#metro-main-text').textContent=!count?'テンポを登録してください':playing?'次のテンポへ':'再生スタート';
    sel('#metro-main-sub').textContent=nl?`${nl} · ${config.presets[nl]} BPM`:'＋A / ＋B / ＋C';
    sel('#metro-advance').disabled=!count;sel('#metro-advance').dataset.letter=nl||'';
    sel('#metro-stop').disabled=!playing;sel('#metro-sound').textContent=config.soundOn?'♫ 音 ON':'♪ 音 OFF';sel('#metro-sound').setAttribute('aria-pressed',String(config.soundOn));
  }
  function audio(){if(context)return context;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('AudioContextが利用できません');context=new AC();
    const duration=.035,rate=context.sampleRate,length=Math.ceil(duration*rate);buffer=context.createBuffer(1,length,rate);const ch=buffer.getChannelData(0);
    let seed=987654321,phase=0;
    for(let i=0;i<length;i++){const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=(seed/4294967295)*2-1;phase+=2*Math.PI*(1650-350*t/duration)/rate;ch[i]=Math.max(-1,Math.min(1,(Math.sin(phase)*.6+noise*.4)*Math.pow(1-t/duration,5)*Math.min(1,t*8000)*.7));}
    return context;
  }
  function haltNodes(){const now=context?.currentTime||0;for(const node of [...pending]){try{node.gain.gain.setValueAtTime(0,now);node.src.stop(now+.001);}catch(_){}pending.delete(node);}}
  function clearVisual(){for(const id of timerIds)clearTimeout(id);timerIds.clear();sel('#metro-dots')?.querySelectorAll('i').forEach(i=>i.classList.remove('lit'));}
  function resetTimer(){clearInterval(interval);interval=null;version++;clearVisual();haltNodes();if(!playing||!context||context.state!=='running')return;when=context.currentTime+.025;beat=0;tick();interval=setInterval(tick,25);}
  function tick(){if(!playing||!context||context.state!=='running')return;const letter=config.sequence[index];if(!letter)return;const distance=60/config.presets[letter],key=version;
    while(when<context.currentTime+.10){const moment=when;const beatNo=beat%4;
      if(config.soundOn){const src=context.createBufferSource(),gain=context.createGain();src.buffer=buffer;gain.gain.value=.95;src.connect(gain);gain.connect(context.destination);const node={src,gain};pending.add(node);src.onended=()=>{pending.delete(node);try{src.disconnect();gain.disconnect();}catch(_){}};src.start(moment);}
      const delay=Math.max(0,(moment-context.currentTime)*1000);const on=setTimeout(()=>{timerIds.delete(on);if(key!==version||!playing)return;const dot=sel('#metro-dots')?.children[beatNo];dot?.classList.add('lit');const off=setTimeout(()=>{timerIds.delete(off);dot?.classList.remove('lit');},95);timerIds.add(off);},delay);timerIds.add(on);
      when+=distance;beat++;
    }
  }
  function stop(){playing=false;index=-1;resetTimer();show();}
  function next(){if(!config.sequence.length)return;index=playing?(index+1)%config.sequence.length:0;playing=true;show();
    const current=config.sequence[index];sel('#metro-announcement').textContent=`${current} ${config.presets[current]} BPM`;try{const ctx=audio();const req=version+1;if(ctx.state==='running')resetTimer();else void ctx.resume().then(()=>{if(playing&&version<=req)resetTimer();}).catch(()=>{stop();});}catch(e){console.warn(e);stop();}
  }
  function mutate(fn){undo.push([...config.sequence]);if(undo.length>50)undo.shift();if(playing)stop();config.sequence=fn(config.sequence);save();show();}
  function changeBpm(l,n){if(!abc.includes(l)||!safe(n))return;config.presets[l]=n;save();show();if(playing&&config.sequence[index]===l)resetTimer();}
  function click(e){const btn=e.target.closest('[data-metro]');if(!btn||!root?.contains(btn)||btn.disabled)return;const act=btn.dataset.metro,l=btn.dataset.letter;
    if(act==='adjust')changeBpm(l,Math.max(30,Math.min(300,config.presets[l]+Number(btn.dataset.delta))));
    if(act==='append'&&config.sequence.length<256)mutate(seq=>[...seq,l]);
    if(act==='remove')mutate(seq=>seq.filter((_,i)=>i!==Number(btn.dataset.index)));
    if(act==='undo'&&undo.length){if(playing)stop();config.sequence=undo.pop();save();show();}
    if(act==='clear'&&config.sequence.length)mutate(()=>[]);
    if(act==='next')next();if(act==='stop')stop();
    if(act==='sound'){config.soundOn=!config.soundOn;save();if(!config.soundOn)haltNodes();show();}
  }
  function change(e){const l=e.target.dataset.bpm;if(l){const n=Number(e.target.value);if(safe(n))changeBpm(l,n);else e.target.value=config.presets[l];}}
  function key(e){if(e.target.closest('input,textarea,select,button'))return;if(e.code==='Space'){e.preventDefault();next();}else if(e.code==='Escape'&&playing){stop();}}
  function visibility(){if(document.hidden&&playing)stop();}
  function mount(element){unmount();root=element;root.innerHTML=markup();root.addEventListener('click',click);root.addEventListener('change',change);root.addEventListener('focusout',blur);document.addEventListener('keydown',key);document.addEventListener('visibilitychange',visibility);show();}
  function blur(e){const l=e.target.dataset?.bpm;if(l)e.target.value=config.presets[l];}
  function unmount(){if(!root)return;stop();root.removeEventListener('click',click);root.removeEventListener('change',change);root.removeEventListener('focusout',blur);document.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',visibility);root=null;}
  function restore(value){config=clean(value);stop();undo=[];save();show();}
  window.KoryoMetronome={mount,unmount,restore,snapshot:()=>copy(config)};
})();
