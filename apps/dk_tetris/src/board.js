'use strict';
const Engine=typeof module!=='undefined'?require('./engine.js'):window.TetrisEngine;
const COLORS={I:'#67dce6',O:'#eccb77',T:'#b89ade',S:'#8cce9b',Z:'#e08484',J:'#829cdf',L:'#e6ad78'};
const FONT={
 '0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111','4':'101101111001001','5':'111100111001111','6':'111100111101111','7':'111001001001001','8':'111101111101111','9':'111101111001111',
 A:'010101111101101',B:'110101110101110',C:'111100100100111',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'111100101101111',H:'101101111101101',I:'111010010010111',L:'100100100100111',M:'101111111101101',N:'101111111111101',O:'111101101101111',P:'110101110100100',R:'110101110101101',S:'111100111001111',T:'111010010010010',U:'101101101101111',V:'101101101101010',X:'101101010101101',' ':'000000000000000'};
function draw(ctx,s){
 function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
 function text(t,x,y,scale,color){String(t).split('').forEach((c,k)=>(FONT[c]||FONT[' ']).split('').forEach((v,i)=>{if(v==='1')rect(x+(k*4+i%3)*scale,y+Math.floor(i/3)*scale,scale,scale,color||'#e5e9e6');}));}
 function cell(x,y,type,ghost,size){const c=COLORS[type],w=size||21;rect(x+1,y+1,w-2,w-2,ghost?'#2b444b':c);if(ghost)rect(x+3,y+3,w-6,w-6,'#111c23');else{rect(x+3,y+3,w-6,2,'#d7e5e4');rect(x+3,y+w-5,w-6,2,'#40545c');}}
 rect(0,0,960,480,'#101a21');rect(342,22,226,436,'#567176');rect(346,26,218,428,'#111c23');
 for(let y=0;y<20;y++)for(let x=0;x<10;x++){rect(350+x*21,30+y*21,20,20,'#17262e');if(s.board[y+2][x])cell(350+x*21,30+y*21,s.board[y+2][x]);}
 if(!s.over){Engine.cells(Engine.ghost(s)).forEach(p=>{if(p[1]>=2)cell(350+p[0]*21,30+(p[1]-2)*21,s.active.type,true);});Engine.cells(s.active).forEach(p=>{if(p[1]>=2)cell(350+p[0]*21,30+(p[1]-2)*21,s.active.type);});}
 text('SCORE',44,54,3,'#91a8b3');text(s.score,44,82,7);text('BEST',44,156,3,'#91a8b3');text(s.best,44,184,5,'#eccb77');text('LINES',44,265,3,'#91a8b3');text(s.lines,44,293,6);text('LEVEL',44,370,3,'#91a8b3');text(s.level,44,398,6);
 text('NEXT',640,54,3,'#91a8b3');Engine.SHAPES[s.queue[0]].forEach(p=>cell(640+p[0]*30,94+p[1]*30,s.queue[0],false,30));
 text('TETRIS',640,248,5,'#67dce6');text('ID7',640,286,3,'#91a8b3');
 if(s.paused||s.over){rect(350,204,210,72,'#101a21');text(s.over?'GAME OVER':'PAUSED',s.over?367:385,229,5,s.over?'#e08484':'#eccb77');}
}
function png(s) {
    const zlib=require('zlib'), w=960,h=480, data=Buffer.alloc(w*h*3);let color=[0,0,0], points=[], circle=null;
    function pixel(x,y){x=Math.round(x);y=Math.round(y);if(x<0||x>=w||y<0||y>=h)return;const i=(y*w+x)*3;data[i]=color[0];data[i+1]=color[1];data[i+2]=color[2];}
    const ctx={set fillStyle(c){color=[1,3,5].map(i=>parseInt(c.substr(i,2),16));},fillRect(x,y,a,b){for(let j=y;j<y+b;j++)for(let i=x;i<x+a;i++)pixel(i,j);},beginPath(){points=[];circle=null;},moveTo(x,y){points.push([x,y]);},lineTo(x,y){points.push([x,y]);},closePath(){},arc(x,y,r){circle=[x,y,r];},fill(){
        if(circle){const x=circle[0],y=circle[1],r=circle[2];for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++)if(i*i+j*j<=r*r)pixel(x+i,y+j);return;}
        const min=Math.min.apply(null,points.map(p=>p[1])),max=Math.max.apply(null,points.map(p=>p[1]));
        for(let y=min;y<max;y++){const xs=[];points.forEach((a,i)=>{const b=points[(i+1)%points.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));});xs.sort((a,b)=>a-b);for(let k=0;k+1<xs.length;k+=2)for(let x=Math.ceil(xs[k]);x<=xs[k+1];x++)pixel(x,y);}
    }};
    draw(ctx,s);
    function crc(b){let c=0xffffffff;for(let i=0;i<b.length;i++){c^=b[i];for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
    function chunk(type,b){const t=Buffer.from(type),n=Buffer.alloc(4),c=Buffer.alloc(4);n.writeUInt32BE(b.length,0);c.writeUInt32BE(crc(Buffer.concat([t,b])),0);return Buffer.concat([n,t,b,c]);}
    const hdr=Buffer.alloc(13);hdr.writeUInt32BE(w,0);hdr.writeUInt32BE(h,4);hdr[8]=8;hdr[9]=2;
    const rows=Buffer.alloc(h*(w*3+1));for(let y=0;y<h;y++)data.copy(rows,y*(w*3+1)+1,y*w*3,(y+1)*w*3);
    return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
if(typeof module!=='undefined')module.exports={draw,png};else window.TetrisBoard={draw};
