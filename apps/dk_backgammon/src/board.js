'use strict';
// The same drawing commands feed the native PNG and the desktop canvas.
function draw(ctx,s) {
    const W=960,H=480;
    function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
    function disc(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
    const digits=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
    function number(n,x,y,c,scale){String(n).split('').forEach((d,k)=>{digits[+d].split('').forEach((v,i)=>{if(v==='1')rect(x+k*4*scale+(i%3)*scale,y+Math.floor(i/3)*scale,scale,scale,c);});});}
    rect(0,0,W,H,'#0e191d');rect(10,10,940,460,'#86613d');rect(24,24,912,432,'#243c3e');rect(462,24,36,432,'#15282c');
    for(let col=0;col<12;col++) {
        const x=36+col*72+(col>=6?24:0);
        for(let row=0;row<2;row++) {
            const i=row===0?12+col:11-col, y=row===0?52:428, tip=row===0?210:270;
            ctx.fillStyle=col%2===row?'#ba986b':'#527375';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+60,y);ctx.lineTo(x+30,tip);ctx.closePath();ctx.fill();
            number(i+1,x+21,row===0?30:439,'#e7d6b9',2);
            const count=Math.abs(s.points[i]), white=s.points[i]>0;
            for(let k=0;k<Math.min(count,5);k++) {const cy=row===0?74+k*31:406-k*31;disc(x+30,cy,23,'#102328');disc(x+30,cy-2,21,white?'#f4e5c8':'#0b1117');disc(x+30,cy-2,15,white?'#dbc7a1':'#283a43');}
            if(count>5)number(count,x+21,row===0?194:278,white?'#142b31':'#ffffff',3);
        }
    }
    [0,1].forEach(p=>{ if(s.bar[p]) {disc(480,p===0?170:310,16,p===0?'#f4e5c8':'#0b1117');number(s.bar[p],475,p===0?163:303,p===0?'#15282c':'#ffffff',2);} });
    s.roll.forEach((d,i)=>{const x=392+i*90;rect(x,217,54,46,'#f4e5c8');number(d,x+19,225,'#142b31',6);});
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
if(typeof module!=='undefined')module.exports={draw,png};else window.Board={draw};
