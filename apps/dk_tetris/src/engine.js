'use strict';
// Compact offline falling-block game. Coordinates include two hidden spawn rows.
const SHAPES = {
 I:[[0,1],[1,1],[2,1],[3,1]], O:[[1,0],[2,0],[1,1],[2,1]],
 T:[[1,0],[0,1],[1,1],[2,1]], S:[[1,0],[2,0],[0,1],[1,1]],
 Z:[[0,0],[1,0],[1,1],[2,1]], J:[[0,0],[0,1],[1,1],[2,1]], L:[[2,0],[0,1],[1,1],[2,1]]
};
const TYPES=Object.keys(SHAPES);
function clone(x){return JSON.parse(JSON.stringify(x));}
function cells(piece){let a=SHAPES[piece.type].map(p=>p.slice());const n=piece.type==='I'?4:3;if(piece.type!=='O')for(let r=0;r<piece.rotation;r++)a=a.map(p=>[n-1-p[1],p[0]]);return a.map(p=>[p[0]+piece.x,p[1]+piece.y]);}
function fits(s,piece){return cells(piece).every(p=>p[0]>=0&&p[0]<10&&p[1]>=0&&p[1]<22&&!s.board[p[1]][p[0]]);}
function refill(s,random){if(s.queue.length>7)return;const bag=TYPES.slice();for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));const t=bag[i];bag[i]=bag[j];bag[j]=t;}s.queue=s.queue.concat(bag);}
function spawn(s,random){refill(s,random);s.active={type:s.queue.shift(),rotation:0,x:3,y:0};s.elapsed=0;if(!fits(s,s.active)){s.over=true;s.paused=true;}}
function initial(random,best){const s={schema:1,board:Array.from({length:22},()=>Array(10).fill('')),queue:[],active:null,score:0,best:best||0,lines:0,level:1,paused:true,over:false,elapsed:0,pieces:0,lastClear:0};spawn(s,random||Math.random);return s;}
function speed(s){return Math.max(350,1500-(s.level-1)*110);}
function ghost(s){const p=clone(s.active);if(!fits(s,p))return p;while(fits(s,Object.assign({},p,{y:p.y+1})))p.y++;return p;}
function lock(s,random){
 cells(s.active).forEach(p=>{s.board[p[1]][p[0]]=s.active.type;});s.pieces++;
 const remaining=s.board.filter(row=>row.some(c=>!c)),count=22-remaining.length;
 s.lastClear=count;s.score+=[0,100,300,500,800][count]*s.level;s.lines+=count;s.level=1+Math.floor(s.lines/10);
 while(remaining.length<22)remaining.unshift(Array(10).fill(''));s.board=remaining;s.best=Math.max(s.best,s.score);
 if(s.board.slice(0,2).some(row=>row.some(Boolean))){s.over=true;s.paused=true;return;}
 spawn(s,random);
}
function step(s,action,random){
 const t=clone(s);random=random||Math.random;
 if(action==='pause'){if(!t.over)t.paused=!t.paused;return t;}
 if(t.paused||t.over)return t;
 const p=clone(t.active);
 if(action==='left'||action==='right'){p.x+=action==='left'?-1:1;if(fits(t,p))t.active=p;}
 else if(action==='rotate'||action==='counter'){p.rotation=(p.rotation+(action==='rotate'?1:3))%4;for(const offset of [[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1],[0,-2]]){const q=Object.assign({},p,{x:p.x+offset[0],y:p.y+offset[1]});if(fits(t,q)){t.active=q;break;}}}
 else if(action==='drop'){const g=ghost(t);t.score+=(g.y-t.active.y)*2;t.active=g;lock(t,random);}
 else if(action==='down'||action==='tick'){p.y++;if(fits(t,p)){t.active=p;if(action==='down')t.score++;}else lock(t,random);}
 t.best=Math.max(t.best,t.score);return t;
}
function advance(s,ms,random){if(s.paused||s.over)return s;let t=clone(s);t.elapsed+=Math.min(2000,Math.max(0,ms));if(t.elapsed>=speed(t)){t.elapsed-=speed(t);t=step(t,'tick',random);}return t;}
function valid(s){
 if(!s||s.schema!==1||!Array.isArray(s.board)||s.board.length!==22||!s.board.every(r=>Array.isArray(r)&&r.length===10&&r.every(c=>c===''||TYPES.includes(c))))return false;
 if(!Array.isArray(s.queue)||s.queue.length<1||s.queue.length>14||!s.queue.every(c=>TYPES.includes(c)))return false;
 const p=s.active;if(!p||!TYPES.includes(p.type)||!Number.isInteger(p.rotation)||p.rotation<0||p.rotation>3||!Number.isInteger(p.x)||!Number.isInteger(p.y))return false;
 if(!['score','best','lines','level','pieces','lastClear'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0)||s.level!==1+Math.floor(s.lines/10)||s.best<s.score||s.lastClear>4)return false;
 if(typeof s.paused!=='boolean'||typeof s.over!=='boolean'||!Number.isFinite(s.elapsed)||s.elapsed<0||s.elapsed>4000)return false;
 return s.over?cells(p).every(c=>c[0]>=0&&c[0]<10&&c[1]>=0&&c[1]<22):fits(s,p);
}
const api={SHAPES,TYPES,cells,fits,initial,step,advance,speed,ghost,valid};
if(typeof module!=='undefined')module.exports=api;else window.TetrisEngine=api;
