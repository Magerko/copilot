const { app, BrowserWindow, desktopCapturer, session, globalShortcut, safeStorage, screen } = require('electron');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const R = {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fgPs = path.join(__dirname, 'fg.ps1');
fs.writeFileSync(fgPs, `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();' -Name W -Namespace U; [U.W]::GetForegroundWindow().ToInt64()`);
const fg = () => execFileSync('powershell', ['-NoProfile','-File',fgPs]).toString().trim();
function wav(file){ const sr=44100, n=sr*20, b=Buffer.alloc(44+n*2);
  b.write('RIFF',0);b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);
  for(let i=0;i<n;i++) b.writeInt16LE(Math.round(Math.sin(2*Math.PI*440*i/sr)*12000),44+i*2); fs.writeFileSync(file,b);}
async function pixel(ov){
  const d = screen.getPrimaryDisplay(); const sf=d.scaleFactor;
  const ts={width:Math.round(d.size.width*sf),height:Math.round(d.size.height*sf)};
  const src=(await desktopCapturer.getSources({types:['screen'],thumbnailSize:ts}))[0];
  const sz=src.thumbnail.getSize(); const bmp=src.thumbnail.toBitmap(); const b=ov.getBounds();
  const x=Math.round((b.x+b.width/2-d.bounds.x)*sz.width/d.bounds.width), y=Math.round((b.y+b.height/2-d.bounds.y)*sz.height/d.bounds.height);
  const o=(y*sz.width+x)*4; return {thumb:sz, at:[x,y], rgb:[bmp[o+2],bmp[o+1],bmp[o]]};
}
app.whenReady().then(async () => {
  R.versions = {electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome};
  const dash = new BrowserWindow({x:900,y:100,width:500,height:400,show:false,webPreferences:{nodeIntegration:true,contextIsolation:false}});
  dash.loadFile(path.join(__dirname,'dash.html')); dash.showInactive();
  const ov = new BrowserWindow({x:100,y:100,width:400,height:300,frame:false,alwaysOnTop:true,focusable:false,show:false,skipTaskbar:true,webPreferences:{}});
  ov.setAlwaysOnTop(true,'screen-saver');
  ov.loadURL('data:text/html,<body style="margin:0;background:rgb(255,0,255)"></body>');
  await sleep(1500);
  // Q1
  const before=fg(); ov.showInactive(); await sleep(1500); const after=fg();
  R.Q1={before,after,unchanged:before===after,isFocusable:ov.isFocusable(),isFocused:ov.isFocused(),isVisible:ov.isVisible(),alwaysOnTop:ov.isAlwaysOnTop()};
  // Q2
  R.Q2={}; R.Q2.unprotected=await pixel(ov);
  ov.setContentProtection(true); await sleep(1000); R.Q2.protected=await pixel(ov);
  ov.setContentProtection(false);
  // Q4
  try{ const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(':memory:'); db.exec('create table t(a)'); db.prepare('insert into t values (?)').run(5); R.Q4_sqlite={ok:true,row:db.prepare('select * from t').get(), ver:db.prepare('select sqlite_version() v').get()}; }catch(e){R.Q4_sqlite={ok:false,err:String(e)}}
  try{ const e=safeStorage.isEncryptionAvailable(); R.Q4_safe={avail:e}; if(e){const enc=safeStorage.encryptString('secret'); R.Q4_safe.roundtrip=safeStorage.decryptString(enc)==='secret'; R.Q4_safe.backend=safeStorage.getSelectedStorageBackend?.();} }catch(e){R.Q4_safe={err:String(e)}}
  // Q5
  try{ R.Q5_shortcut={ok:globalShortcut.register('Control+Alt+Space',()=>{}),isRegistered:globalShortcut.isRegistered('Control+Alt+Space')}; }catch(e){R.Q5_shortcut={err:String(e)}}
  await sleep(2000);
  const m=app.getAppMetrics(); const mb=k=>Math.round(k/1024);
  R.Q5_mem={procs:m.map(p=>({type:p.type,ws_MB:mb(p.memory.workingSetSize)})),total_MB:mb(m.reduce((s,p)=>s+p.memory.workingSetSize,0))};
  // Q3
  const wf=path.join(os.tmpdir(),'tone.wav'); wav(wf);
  session.defaultSession.setDisplayMediaRequestHandler(async (req,cb)=>{ const s=await desktopCapturer.getSources({types:['screen']}); cb({video:s[0],audio:'loopback'}); });
  const player=spawn('powershell',['-NoProfile','-Command',`(New-Object System.Media.SoundPlayer '${wf}').PlaySync()`]);
  await sleep(1000);
  try{
  R.Q3 = await dash.webContents.executeJavaScript(`(async()=>{
    const out={};
    const rms=async(stream)=>{ const ctx=new AudioContext(); const an=ctx.createAnalyser(); an.fftSize=2048; ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(an);
      let max=0; const buf=new Float32Array(2048); for(let i=0;i<15;i++){ await new Promise(r=>setTimeout(r,100)); an.getFloatTimeDomainData(buf); let s=0; for(const v of buf)s+=v*v; max=Math.max(max,Math.sqrt(s/buf.length)); } await ctx.close(); return max; };
    try{
      const s=await navigator.mediaDevices.getDisplayMedia({audio:true,video:true});
      out.audioTracks=s.getAudioTracks().map(t=>({label:t.label,state:t.readyState}));
      out.videoTracks=s.getVideoTracks().length;
      out.rmsWithVideo=await rms(s);
      s.getVideoTracks().forEach(t=>{t.stop(); s.removeTrack(t);});
      out.videoAfterStop=s.getVideoTracks().length;
      out.audioStateAfterVideoStop=s.getAudioTracks().map(t=>t.readyState);
      out.rmsAfterVideoStop=await rms(s);
      s.getTracks().forEach(t=>t.stop());
    }catch(e){out.displayErr=String(e)}
    try{
      const m=await navigator.mediaDevices.getUserMedia({audio:true});
      out.mic={tracks:m.getAudioTracks().map(t=>t.label)}; m.getTracks().forEach(t=>t.stop());
    }catch(e){out.micErr=e.name+': '+e.message}
    const dv=await navigator.mediaDevices.enumerateDevices(); out.audioinputCount=dv.filter(d=>d.kind==='audioinput').length;
    return out;})()`);
  }catch(e){R.Q3={err:String(e)}}
  player.kill();
  fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify(R,null,1));
  app.quit();
});
setTimeout(()=>{fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify(R,null,1));process.exit(1)},60000);

