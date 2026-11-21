(function(){
  const d=window.SAIWAI_SEED;
  const parsed=window.KoryoCloudModel.convert(d);
  window.KORYOSAN_SONGS=parsed.songs;
  window.KORYOSAN_DETAILS=parsed.details;
  window.KORYOSAN_EXTRA=parsed.extras;
  window.KORYOSAN_PRACTICE=parsed.practice;
  window.KORYOSAN_TUNINGS=['レギュラー'];
  window.__KORYO_INITIAL_STATE=parsed.state;
  try {const raw=localStorage.getItem('saiwaisan.test.data.v1');if(raw)window.__SAIWAI_LOCAL_STATE=JSON.parse(raw);}catch(error){console.warn('保存データ:',error);}
})();
