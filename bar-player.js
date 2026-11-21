'use strict';
/* さいわいさん：MIDI-derived bar-indexed MP3 review player (test version). */
(function(global){
  const modal=document.getElementById('modal-root');
  let active=null;
  const escapeText=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp=s=>{const n=Math.max(0,Math.floor(Number(s)||0));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
  function barForTime(bars,time,upperBound){
    if(!bars.length||time>=upperBound)return null;
    let lo=0,hi=bars.length-1;
    while(lo<=hi){const mid=(lo+hi)>>1;
      if(bars[mid].time<=time)lo=mid+1;
      else hi=mid-1;
    }
    return bars[Math.max(0,hi)];
  }
  function render({songTitle,reviewTitle,sections,comments,overall,barMap,audioSrc,onClose}){
    destroy();
    const markers=barMap.markers||[];
    const maxBar=barMap.totalMappedBars;
    const marksByIndex=markers.slice(0,sections.length);
    const total=Number(barMap.mp3DurationSeconds)||0;
    const rows=[`<div class="bp-review-row bp-overall" data-bp-review="overall"><div class="bp-review-section"><strong>全体</strong></div><div class="bp-review-text">${escapeText(overall||'—')}</div></div>`];
    for(let i=0;i<sections.length;i++){
      const section=sections[i],marker=marksByIndex[i];
      rows.push(`<div class="bp-review-row" data-bp-review="${i}" data-bar="${marker?.bar||''}">
          <div class="bp-review-section"><button type="button" data-bp-action="section" data-row="${i}" title="このセクションから再生">${escapeText(section.section||'')}</button>
            ${marker?`<span>MIDI ${String(marker.bar).padStart(3,'0')}小節</span>`:''}</div>
          <div class="bp-review-text">${escapeText(comments[i]||'—')}</div>
        </div>`);
    }
    modal.innerHTML=`<div class="bp-overlay" data-bp-action="backdrop"><section class="bp-dialog" role="dialog" aria-modal="true" aria-labelledby="bp-dialog-title">
      <header class="bp-dialog-heading"><div><span class="bp-eyebrow">小節指定プレーヤー · テスト</span><h2 id="bp-dialog-title">${escapeText(songTitle)} <small>／ ${escapeText(reviewTitle)}</small></h2></div><button type="button" class="bp-close" data-bp-action="close" aria-label="閉じる">×</button></header>
      <div class="bp-scroller" id="bp-scroller">
        <div class="bp-player" aria-label="音声の小節指定再生">
          <div class="bp-audio-head"><div><span class="bp-audio-filename">drスタジオ反映全編_20261108_0時　郵政局.mp3</span><span class="bp-audio-meta">${barMap.bpm} BPM · 基本 4/4 · MIDI ${maxBar}小節</span></div><span class="bp-audio-availability" id="bp-status" role="status" aria-live="polite">読み込み中</span></div>
          <div class="bp-playline"><button type="button" id="bp-toggle" class="bp-play" data-bp-action="toggle" aria-label="再生">▶</button><div class="bp-time-control"><input id="bp-time-range" type="range" min="0" max="${total.toFixed(3)}" value="0" step="0.01" aria-label="再生位置"><div class="bp-time-labels"><span id="bp-current-time">00:00</span><span id="bp-duration">${stamp(total)}</span></div></div></div>
          <div class="bp-bar-meta"><div><span>現在の小節</span><strong id="bp-current-bar">001</strong><small> / ${String(maxBar).padStart(3,'0')} 小節</small><span class="bp-beat" id="bp-current-beat">4/4 · 1拍目</span></div><label class="bp-follow"><input id="bp-follow" type="checkbox" checked> 構成に追従</label></div>
          <input id="bp-bar-range" class="bp-bar-range" type="range" min="1" max="${maxBar}" value="1" step="1" aria-label="移動先の小節"><div class="bp-bar-endpoints"><span>001</span><span>${String(maxBar).padStart(3,'0')}</span></div>
          <div class="bp-seek-actions"><div class="bp-jumps"><button data-bp-action="jump" data-offset="-4" aria-label="4小節戻る">−4</button><button data-bp-action="jump" data-offset="-1" aria-label="1小節戻る">−1</button><button data-bp-action="jump" data-offset="1" aria-label="1小節進む">＋1</button><button data-bp-action="jump" data-offset="4" aria-label="4小節進む">＋4</button></div><div class="bp-go"><label for="bp-bar-number">小節</label><input id="bp-bar-number" type="number" inputmode="numeric" min="1" max="${maxBar}" value="1"><button class="bp-go-button" data-bp-action="go">ここから再生</button></div></div>
          <label class="bp-lead-option"><input id="bp-lead" type="checkbox" checked> 指定小節の <b>0.5秒前</b> から再生</label><p class="bp-warning">MIDIの後半では、下表の元の小節番号と実際のMIDI位置に16小節の差があります。再生位置は「MIDI ○○小節」を使用します。MIDI終了後（4:20以降）は小節カウントの対象外です。</p>
        </div>
        <div class="bp-review-table" role="table" aria-label="構成と追記メモ"><div class="bp-review-heading" role="row"><span>構成</span><span>${escapeText(reviewTitle)}</span></div>${rows.join('')}</div>
      </div>
      <audio id="bp-audio" preload="metadata" src="${escapeText(audioSrc)}"></audio>
    </section></div>`;
    const audio=modal.querySelector('#bp-audio');
    const els={player:modal.querySelector('.bp-player'),toggle:modal.querySelector('#bp-toggle'),time:modal.querySelector('#bp-time-range'),curTime:modal.querySelector('#bp-current-time'),bar:modal.querySelector('#bp-bar-range'),curBar:modal.querySelector('#bp-current-bar'),beat:modal.querySelector('#bp-current-beat'),barNumber:modal.querySelector('#bp-bar-number'),status:modal.querySelector('#bp-status'),follow:modal.querySelector('#bp-follow'),lead:modal.querySelector('#bp-lead'),scroller:modal.querySelector('#bp-scroller')};
    let alive=true,raf=0,timeDragging=false,barDragging=false,lastHighlighted=-1,pendingPlay=false,pendingTime=null,selectedBar=1;
    function markSection(time){
      let section=0;
      for(let i=0;i<marksByIndex.length;i++)if(time>=marksByIndex[i].seconds)section=i;
      if(section===lastHighlighted)return;
      lastHighlighted=section;
      modal.querySelectorAll('[data-bp-review]').forEach(el=>el.classList.toggle('bp-review-active',el.dataset.bpReview===String(section)));
      if(els.follow.checked&&audio&&!audio.paused){
        const row=modal.querySelector(`[data-bp-review="${section}"]`);
        if(row){const rect=row.getBoundingClientRect(),clip=els.scroller.getBoundingClientRect(),headerBottom=els.player.getBoundingClientRect().bottom;
          if(rect.top<headerBottom+12||rect.bottom>clip.bottom-16)els.scroller.scrollBy({top:rect.top-headerBottom-24,behavior:'smooth'});
        }
      }
    }
    function draw(){if(!alive)return;
      const time=audio.currentTime||0;
      if(!timeDragging){els.time.value=String(time);els.curTime.textContent=stamp(time);}
      const bar=barForTime(barMap.bars,time,barMap.midiDurationSeconds);
      if(bar){
        const beatDuration=60/barMap.bpm*4/bar.denominator;
        const beat=Math.max(1,Math.min(bar.numerator,Math.floor((time-bar.time+1e-6)/beatDuration)+1));
        els.curBar.textContent=String(bar.bar).padStart(3,'0');els.beat.textContent=`${bar.numerator}/${bar.denominator} · ${beat}拍目`;
        if(!barDragging){selectedBar=bar.bar;els.bar.value=String(bar.bar);if(document.activeElement!==els.barNumber)els.barNumber.value=String(bar.bar);}
        markSection(time);
      }else{
        els.curBar.textContent='—';els.beat.textContent='MIDI終了後（小節未割当）';
        if(!barDragging){els.bar.value=String(maxBar);if(document.activeElement!==els.barNumber)els.barNumber.value=String(maxBar);}
      }
      els.toggle.textContent=audio.paused?'▶':'❚❚';els.toggle.setAttribute('aria-label',audio.paused?'再生':'一時停止');
      if(!audio.paused)raf=requestAnimationFrame(draw);
    }
    function stopAnimation(){cancelAnimationFrame(raf);raf=0;}
    function seek(seconds,play=true){
      const max=Number.isFinite(audio.duration)?audio.duration:total;
      const value=Math.min(Math.max(0,seconds),Math.max(0,max-.02));
      pendingTime=value;pendingPlay=play;
      if(audio.readyState>=1){audio.currentTime=value;pendingTime=null;
        if(play)void audio.play().catch(()=>{els.status.textContent='再生できません。ブラウザで音声を許可してください';});
        draw();
      }else{audio.load();}
    }
    function goToBar(value){
      const n=Math.max(1,Math.min(maxBar,Math.trunc(Number(value)||1)));
      selectedBar=n;els.bar.value=String(n);els.barNumber.value=String(n);
      const seconds=barMap.bars[n-1].time;
      seek(Math.max(0,seconds-(els.lead.checked?.5:0)),true);
    }
    const click=e=>{
      const control=e.target.closest('[data-bp-action]');if(!control||!modal.contains(control))return;
      const cmd=control.dataset.bpAction;
      if(cmd==='backdrop'){if(e.target===control)onClose();return;}
      if(cmd==='close'){onClose();return;}
      if(cmd==='toggle'){if(audio.paused){void audio.play().catch(()=>{els.status.textContent='再生に失敗しました';});}else audio.pause();return;}
      if(cmd==='go'){goToBar(els.barNumber.value);return;}
      if(cmd==='jump'){goToBar((barForTime(barMap.bars,audio.currentTime,barMap.midiDurationSeconds)?.bar||selectedBar)+Number(control.dataset.offset));return;}
      if(cmd==='section'){const idx=Number(control.dataset.row),entry=marksByIndex[idx];if(entry)goToBar(entry.bar);return;}
    };
    const input=e=>{
      if(e.target===els.time){timeDragging=true;els.curTime.textContent=stamp(els.time.value);return;}
      if(e.target===els.bar){barDragging=true;const next=Math.trunc(Number(els.bar.value));els.barNumber.value=String(next);els.curBar.textContent=String(next).padStart(3,'0');els.beat.textContent=`${barMap.bars[next-1]?.numerator||4}/${barMap.bars[next-1]?.denominator||4} · 移動先`;return;}
    };
    const change=e=>{
      if(e.target===els.time){timeDragging=false;seek(Number(els.time.value),false);return;}
      if(e.target===els.bar){barDragging=false;goToBar(els.bar.value);return;}
    };
    const keyboard=e=>{if(e.key==='Enter'&&e.target===els.barNumber){e.preventDefault();goToBar(els.barNumber.value);}};
    const loaded=()=>{els.status.textContent='再生準備OK';
      if(pendingTime!=null){audio.currentTime=pendingTime;pendingTime=null;}
      if(pendingPlay){pendingPlay=false;void audio.play().catch(()=>{els.status.textContent='再生に失敗しました';});}
      draw();};
    const error=()=>{els.status.textContent='音声を取得できません。PWAをWebサーバーで開いてください';};
    const play=()=>{els.status.textContent='再生中';stopAnimation();draw();};
    const pause=()=>{els.status.textContent=audio.ended?'再生終了':'一時停止';stopAnimation();draw();};
    const ontime=()=>{if(audio.paused)draw();};
    modal.addEventListener('click',click);modal.addEventListener('input',input);modal.addEventListener('change',change);modal.addEventListener('keydown',keyboard);
    audio.addEventListener('loadedmetadata',loaded);audio.addEventListener('error',error);audio.addEventListener('play',play);audio.addEventListener('pause',pause);audio.addEventListener('timeupdate',ontime);
    document.body.classList.add('bp-modal-open');
    active={audio,close:()=>{alive=false;stopAnimation();audio.pause();audio.removeAttribute('src');audio.load();modal.removeEventListener('click',click);modal.removeEventListener('input',input);modal.removeEventListener('change',change);modal.removeEventListener('keydown',keyboard);document.body.classList.remove('bp-modal-open');}};
    draw();
  }
  function destroy(){if(active){const tmp=active;active=null;tmp.close();}}
  global.SaiwaiBarPlayer={open:render,destroy,barForTime};
})(window);
