'use strict';
const E=typeof module!=='undefined'?require('./engine.js'):window.TetrisEngine;
class Game{
 constructor(saved,random){this.random=random||Math.random;this.state=E.valid(saved)?JSON.parse(JSON.stringify(saved)):E.initial(this.random);this.state.paused=true;this.confirm=false;}
 actions(){return this.confirm?[{op:'cancel',label:'Отмена'},{op:'new',label:'Начать заново'}]:[
 {op:'left',label:'Влево'},{op:'right',label:'Вправо'},{op:'rotate',label:'Повернуть'},
 {op:'down',label:'Вниз'},{op:'drop',label:'Сбросить'},
 {op:'pause',label:this.state.paused?'Продолжить':'Пауза'},{op:'confirm',label:'Новая игра…'}];}
 act(op){if(op==='confirm'){this.state.paused=true;this.confirm=true;return;}if(op==='cancel'){this.confirm=false;return;}if(op==='new'){if(!this.confirm)return;this.state=E.initial(this.random,this.state.best);this.confirm=false;return;}if(this.confirm)return;this.state=E.step(this.state,op,this.random);}
 tick(ms){this.state=E.advance(this.state,ms,this.random);}
 pause(){this.state.paused=true;}
 status(){const s=this.state;return(s.over?'Игра окончена':s.paused?'Пауза':'Игра')+' · очки '+s.score+' · линии '+s.lines+' · уровень '+s.level+' · рекорд '+s.best;}
}
if(typeof module!=='undefined')module.exports=Game;else window.TetrisGame=Game;
