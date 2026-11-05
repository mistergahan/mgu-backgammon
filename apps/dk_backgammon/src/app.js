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
        this.dir=fs.mkdtempSync(path.join(fs.existsSync('/dev/shm')?'/dev/shm':os.tmpdir(),'backgammon-'));fs.chmodSync(this.dir,0o755);
        this.on('initialized',()=>this.setup().catch(e=>logger.error(e.stack||e.message)).then(()=>{this.busy=false;}));
        this.on('entryPointExecute',uuid=>{if(this.rhmiApplication)this.rhmiApplication.openEntryState(uuid).catch(e=>logger.warn(e.message));});
        this.on('error',e=>logger.error(e.message));
        this.on('shutdown',()=>{this.stopping=true;this.save();this.cleanup().then(()=>process.exit(0));});
    }
    save(){try{if(!fs.existsSync(DATA))fs.mkdirSync(DATA);fs.writeFileSync(SAVE+'.tmp',JSON.stringify(this.game.snapshot()),{mode:0o600});fs.renameSync(SAVE+'.tmp',SAVE);this.saveError='';}catch(e){this.saveError='Не удалось сохранить партию';logger.warn(e.message);}}
    setup(){
        const r=this.rhmiApplication;if(!r)return this.initialized();
        this.board=r.getByName('board');this.status=r.getByName('status');this.list=r.getByName('moves');
        this.list.on('action',ev=>this.press(Number(ev&&ev.row)||0));
        r.on('restoreHmi',()=>{if(!this.busy){this.busy=true;this.render().catch(e=>logger.warn(e.message)).then(()=>{this.busy=false;});}});
        const descriptions=this.appDescription.application.entryPoints;
        const ep=this.getEntryPoints().find(e=>descriptions.some(d=>d.uuid===e.getDescription().uuid));
        if(!ep)throw new Error('Entry point unavailable');
        const d=ep.getDescription();
        return ep.init().then(()=>r.mapEntryState(d.uuid,r.getByName('ST_Backgammon')))
            .then(()=>ep.entryPoint.setText(d.textId)).then(()=>ep.entryPoint.setIcon(d.icon))
            .then(()=>ep.setAvailability('ENABLED')).then(()=>this.render()).then(()=>this.initialized())
            .then(()=>{const id=this.getLastExecutedEntryPointUuid&&this.getLastExecutedEntryPointUuid();if(id){this.registerActive();return r.openEntryState(id);}});
    }
    press(row){
        if(this.busy||this.stopping||!this.rows[row])return;
        this.busy=true;
        try{this.game.act(this.rows[row],die);this.save();}catch(e){logger.warn(e.message);}
        this.render().catch(e=>logger.error(e.message)).then(()=>{this.busy=false;});
    }
    render(){
        const r=this.rhmiApplication,s=this.game.state,rows=this.game.actions();
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
