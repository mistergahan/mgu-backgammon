'use strict';
const E = typeof module !== 'undefined' ? require('./engine.js') : window.Backgammon;
function Game(saved) {
    this.state = saved && E.valid(saved.state) ? saved.state : E.initial();
    this.mode = saved && saved.mode === 'local' ? 'local' : 'computer';
    this.history = []; this.confirm = false; this.note = "";
}
Game.prototype.snapshot = function() { return {schema:1,state:this.state,mode:this.mode}; };
Game.prototype.status = function() {
    const s=this.state, who = s.player===0 ? 'Белые' : 'Чёрные';
    if(s.winner!==null) return (s.winner===0?'Белые':'Чёрные')+' победили · '+s.pointsWon+' очк.';
    if(s.opening && this.note) return this.note;
    if(s.opening) return 'Первый бросок: каждому по одной кости. При равенстве — переброс.';
    return (s.variant==='long'?'Длинные · ':'Короткие · ')+who+' · '+(s.roll.length ? 'кости '+s.roll.join(' : ')+' · осталось '+(s.dice.join(', ')||'—') : 'бросьте кости');
};
Game.prototype.actions = function() {
    const s=this.state;
    if(this.confirm) return [{label:'Отмена',op:'cancel'}].concat(['short','long'].reduce((all,variant)=>all.concat(['computer','local'].map(mode=>({label:(variant==='long'?'Длинные':'Короткие')+' · '+(mode==='computer'?'с компьютером':'вдвоём'),op:'new',mode,variant}))),[]));
    const a=[];
    if(s.winner===null) {
        if(s.opening || !s.roll.length) a.push({label:s.opening?'Первый бросок':'Бросить кости',op:'roll'});
        else {
            const moves=E.legal(s);
            if(this.mode==='computer' && s.player===1 && moves.length) a.push({label:'Ход компьютера',op:'ai'});
            else moves.forEach(m=>a.push({label:(m.from===-1?'Бар':m.from+1)+' → '+(m.to===24?'Снять':m.to+1)+'   [ '+m.die+' ]',op:'move',move:m}));
            if(!moves.length) a.push({label:s.dice.length?'Нет ходов · передать очередь':'Завершить ход',op:'finish'});
        }
        if(this.history.length) a.push({label:'Отменить движение',op:'undo'});
    }
    a.push({label:'Новая партия…',op:'confirm'}); return a;
};
Game.prototype.act = function(a,die) {
    if(!this.actions().some(x=>JSON.stringify(x)===JSON.stringify(a))) throw new Error('Действие устарело');
    if(a.op==='confirm') this.confirm=true;
    else if(a.op==='cancel') this.confirm=false;
    else if(a.op==='new') {this.state=E.initial(a.variant);this.mode=a.mode;this.history=[];this.confirm=false;this.note='';}
    else if(a.op==='roll') {const rolled=[];this.state=E.roll(this.state,()=>{const d=die();rolled.push(d);return d;});this.note=this.state.opening?'Выпало '+rolled.join(' : ')+' · равенство, бросьте ещё раз':'';this.history=[];}
    else if(a.op==='finish') {this.state=E.finish(this.state);this.history=[];}
    else if(a.op==='undo') this.state=this.history.pop();
    else {const m=a.op==='ai'?E.ai(this.state):a.move;this.history.push(E.copy(this.state));this.state=E.move(this.state,m);}
};
if(typeof module !== 'undefined') module.exports=Game; else window.Game=Game;
