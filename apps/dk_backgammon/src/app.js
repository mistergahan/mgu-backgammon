'use strict';
const OnlineApp=require('oap-sdk/src/core/OnlineApp.js');
const logging=require('oap-sdk/src/logging/logging');
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const Game=require('./game.js'),Board=require('./board.js');
const logger=logging.getSDKLogger();
const DATA=path.join(__dirname,'..','..','data'), SAVE=path.join(DATA,'backgammon.json');
function die(){let n;do{n=crypto.randomBytes(1)[0];}while(n>=252);return n%6+1;}
class BackgammonApp extends OnlineApp {
    constructor(){
        super();let saved=null;
        try{saved=JSON.parse(fs.readFileSync(SAVE,'utf8'));}catch(e){if(e.code!=='ENOENT')logger.warn('Cannot read saved game: '+e.message);}
        this.game=new Game(saved);this.busy=true;this.image=null;this.seq=0;this.rows=[];this.saveError='';
        this.dir=null;
        this.on('initialized',()=>Promise.resolve().then(()=>this.setup()).catch(e=>logger.error(e.stack||e.message)).then(()=>{this.busy=false;}));
        this.launchReady=false;
        this.on('entryPointExecute',uuid=>{
            if(!this.launchReady){this.pendingEntry=uuid;return;}
            this.openGame(uuid).catch(e=>logger.warn(e.message));
        });
        this.on('error',e=>logger.error(e.message));
        this.on('shutdown',()=>{this.stopping=true;this.save();this.cleanup().then(()=>process.exit(0));});
    }
    save(){try{if(!fs.existsSync(DATA))fs.mkdirSync(DATA);fs.writeFileSync(SAVE+'.tmp',JSON.stringify(this.game.snapshot()),{mode:0o600});fs.renameSync(SAVE+'.tmp',SAVE);this.saveError='';}catch(e){this.saveError='Не удалось сохранить партию';logger.warn(e.message);}}
    openGame(uuid){
        if(!uuid||!this.rhmiApplication)return Promise.resolve();
        
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
        }catch(e){logger.warn('Entry point appearance: '+e.message);}
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
        this.board=r.getByName('board');this.status=r.getByName('status');this.list=r.getByName('moves');
        this.list.on('action',ev=>this.press(Number(ev&&ev.row)||0));
        r.on('restoreHmi',()=>{if(!this.busy){this.busy=true;this.render().catch(e=>logger.warn(e.message)).then(()=>{this.busy=false;});}});
        const descriptions=this.appDescription.application.entryPoints;
        const ep=this.getEntryPoints().find(e=>descriptions.some(d=>d.uuid===e.getDescription().uuid));
        if(!ep)throw new Error('Entry point unavailable');
        return this.startScreen(ep,r.getByName('ST_Backgammon')).then(()=>this.render());
    }
    press(row){
        if(this.busy||this.stopping||!this.rows[row])return;
        this.busy=true;
        try{this.game.act(this.rows[row],die);this.save();}catch(e){logger.warn(e.message);}
        this.render().catch(e=>logger.error(e.message)).then(()=>{this.busy=false;});
    }
    render(){
        const r=this.rhmiApplication,s=this.game.state,rows=this.game.actions();
        if(!this.dir){
            let failure;
            for(const parent of ['/dev/shm',os.tmpdir()]){
                try{
                    const dir=fs.mkdtempSync(path.join(parent,'dk_backgammon-'));
                    fs.chmodSync(dir,0o755);
                    this.dir=dir;
                    break;
                }catch(e){failure=e;}
            }
            if(!this.dir)throw failure;
        }
        const file=path.join(this.dir,'board-'+(++this.seq)+'.png'),old=this.image,bundle=r.getResourceBundle();
        fs.writeFileSync(file,Board.png(s),{mode:0o644});
        this.rows=[];
        return Promise.resolve(bundle.createResourceHandles([file]))
            .then(()=>this.board.setValue(0,'Graphic',file,'ResourceId'))
            .then(()=>this.status.setValue(0,'Text',this.game.status()+' · снято '+s.off.join(' / ')+(this.saveError?' · '+this.saveError:''),'Text'))
            .then(()=>this.list.setRowCount(rows.length))
            .then(()=>Promise.all(rows.map((a,i)=>this.list.setValue(i,'Text',a.label,'Text'))))
            .then(()=>r.flush()).then(()=>{this.rows=rows;this.image=file;return old?this.retire(old):null;})
            .catch(e=>this.retire(file).then(()=>{throw e;}));
    }
    retire(file){return Promise.resolve().then(()=>this.rhmiApplication.getResourceBundle().destroyResourceHandles([file])).catch(e=>logger.warn(e.message)).then(()=>{try{fs.unlinkSync(file);}catch(e){}});}
    cleanup(){return (this.image?this.retire(this.image):Promise.resolve()).then(()=>{try{fs.rmdirSync(this.dir);}catch(e){}});}
}
const app=new BackgammonApp();app.start().catch(e=>logger.error(e.stack||e.message));
