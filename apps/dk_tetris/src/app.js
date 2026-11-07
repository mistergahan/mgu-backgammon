'use strict';
const OnlineApp=require('oap-sdk/src/core/OnlineApp.js');
const logging=require('oap-sdk/src/logging/logging');
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const Game=require('./game.js'),Board=require('./board.js');
const log=logging.getSDKLogger(),DATA=path.join(__dirname,'..','..','data'),SAVE=path.join(DATA,'tetris.json');
function random(){return crypto.randomBytes(4).readUInt32BE(0)/4294967296;}
function truth(v){return v===true||v===1||v==='true'||v==='1';}
class TetrisApp extends OnlineApp{
 constructor(){
  super();let saved=null;try{saved=JSON.parse(fs.readFileSync(SAVE,'utf8'));}catch(e){if(e.code!=='ENOENT')log.warn(e.message);}
  this.game=new Game(saved,random);this.foreground=false;this.ready=false;this.stopping=false;this.dirty=false;this.chain=Promise.resolve();this.rendering=false;this.rows=[];this.image=null;this.seq=0;this.menuKey='';this.saveTimer=null;this.timer=null;this.saveError='';
  this.dir=null;
  this.on('initialized',()=>Promise.resolve().then(()=>this.setup()).catch(e=>log.error(e.stack||e.message)));
  this.launchReady=false;
        this.on('entryPointExecute',uuid=>{
            if(!this.launchReady){this.pendingEntry=uuid;return;}
            this.openGame(uuid).catch(e=>log.warn(e.message));
        });
  this.on('changeVisibility',data=>{if(data&&data.visible===false)this.hide();});
  this.on('shutdown',()=>this.shutdown().then(()=>process.exit(0)));
  this.on('error',e=>log.error(e.message));
 }
 save(){clearTimeout(this.saveTimer);this.saveTimer=null;try{if(!fs.existsSync(DATA))fs.mkdirSync(DATA);fs.writeFileSync(SAVE+'.tmp',JSON.stringify(this.game.state),{mode:0o600});fs.renameSync(SAVE+'.tmp',SAVE);this.saveError='';}catch(e){this.saveError='Не удалось сохранить';log.warn(e.message);}}
 saveSoon(){if(!this.saveTimer)this.saveTimer=setTimeout(()=>this.save(),500);}
 hide(){this.foreground=false;this.game.pause();this.save();this.requestRender();}
 openGame(uuid){
        if(!uuid||!this.rhmiApplication)return Promise.resolve();
        this.foreground=true;
        return Promise.resolve().then(()=>this.rhmiApplication.openEntryState(uuid));
    }
    async startScreen(ep,host){
        const d=ep.getDescription();
        await host.updateResources();
        await ep.init();
        await this.rhmiApplication.mapEntryState(d.uuid,host);
        try{
            await ep.entryPoint.setText(d.textId);
            if(d.icon)await ep.entryPoint.setIcon(d.icon);
        }catch(e){log.warn('Entry point appearance: '+e.message);}
        await ep.setAvailability('ENABLED');
        const data=this.getVisibilityData && this.getVisibilityData();
        const reason=(data && data.reason)||this.startReason;
        const lastEntry=()=>this.getLastExecutedEntryPointUuid && this.getLastExecutedEntryPointUuid();
        const foregroundStart=['ENTRY_POINT','LUM','BOOKMARK','START_WIDGET','TRIGGER_HMI','SPEECH_COMMAND'].indexOf(reason)>=0;
        if(this.pendingEntry || lastEntry() || foregroundStart){
            this.registerActive();
        }
        await this.initialized();
        this.launchReady=true;
        const firstEntry=this.pendingEntry || lastEntry() || (foregroundStart ? d.uuid : null);
        this.pendingEntry=null;
        await this.openGame(firstEntry);
    }
    setup(){
  const r=this.rhmiApplication;if(!r)return this.initialized();
  this.board=r.getByName('board');this.status=r.getByName('status');this.list=r.getByName('moves');this.host=r.getByName('ST_Tetris');
  this.list.on('action',ev=>this.press(Number(ev&&ev.row)||0));
  this.host.on('visible',ev=>{if(truth(ev&&ev.visible))this.foreground=true;else this.hide();});
  this.host.on('focus',ev=>{if(!truth(ev&&ev.focus))this.hide();});
  r.on('restoreHmi',()=>{this.game.pause();this.menuKey='';this.requestRender();});
  const descriptions=this.appDescription.application.entryPoints;
  const ep=this.getEntryPoints().find(e=>descriptions.some(d=>d.uuid===e.getDescription().uuid));if(!ep)throw new Error('Entry point unavailable');return this.startScreen(ep,this.host).then(()=>{
    this.ready=true;
    this.lastTime=Date.now();
    this.timer=setInterval(()=>this.tick(),100);
    return this.requestRender();
   });
 }
 press(row){if(!this.ready||this.stopping||!this.rows[row])return;this.game.act(this.rows[row].op);this.lastTime=Date.now();this.saveSoon();this.requestRender();}
 tick(){const now=Date.now(),ms=now-this.lastTime;this.lastTime=now;if(!this.foreground||this.stopping||this.game.state.paused)return;const before=JSON.stringify([this.game.state.active,this.game.state.pieces]);this.game.tick(ms);if(before!==JSON.stringify([this.game.state.active,this.game.state.pieces])){this.saveSoon();this.requestRender();}}
 requestRender(){
  if(!this.ready||this.stopping)return this.chain;this.dirty=true;if(this.rendering)return this.chain;
  this.rendering=true;this.chain=this.chain.then(()=>this.drain()).catch(e=>{this.menuKey='';log.error('Render: '+e.message);}).then(()=>{this.rendering=false;});return this.chain;
 }
 drain(){if(!this.dirty||this.stopping)return Promise.resolve();this.dirty=false;return this.render().then(()=>this.drain());}
 render(){
  if(!this.dir){
            let failure;
            for(const parent of ['/dev/shm',os.tmpdir()]){
                try{
                    const dir=fs.mkdtempSync(path.join(parent,'dk_tetris-'));
                    fs.chmodSync(dir,0o755);
                    this.dir=dir;
                    break;
                }catch(e){failure=e;}
            }
            if(!this.dir)throw failure;
        }
        const r=this.rhmiApplication,rows=this.game.actions(),menu=JSON.stringify(rows),file=path.join(this.dir,'board-'+(++this.seq)+'.png'),old=this.image,bundle=r.getResourceBundle();
  const status=this.game.status()+(this.saveError?' · '+this.saveError:'');fs.writeFileSync(file,Board.png(this.game.state),{mode:0o644});
  return Promise.resolve(bundle.createResourceHandles([file])).then(()=>this.board.setValue(0,'Graphic',file,'ResourceId')).then(()=>this.status.setValue(0,'Text',status,'Text'))
   .then(()=>{if(menu===this.menuKey)return;return Promise.resolve(this.list.setRowCount(rows.length)).then(()=>Promise.all(rows.map((a,i)=>this.list.setValue(i,'Text',a.label,'Text'))));})
   .then(()=>r.flush()).then(()=>{this.rows=rows;this.menuKey=menu;this.image=file;return old?this.retire(old):null;})
   .catch(e=>this.retire(file).then(()=>{throw e;}));
 }
 retire(file){return Promise.resolve().then(()=>this.rhmiApplication.getResourceBundle().destroyResourceHandles([file])).catch(e=>log.warn(e.message)).then(()=>{try{fs.unlinkSync(file);}catch(e){}});}
 shutdown(){if(this.stopping)return this.chain;this.stopping=true;clearInterval(this.timer);this.game.pause();this.save();return this.chain.then(()=>this.image?this.retire(this.image):null).then(()=>{try{fs.rmdirSync(this.dir);}catch(e){}});}
}
const app=new TetrisApp();app.start().catch(e=>log.error(e.stack||e.message));
