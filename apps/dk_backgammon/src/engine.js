'use strict';
// Indices are zero based. Short: opposite directions; long: both decrease, wrapping at 0.
// Bar is -1, off is 24. Long-game heads: white 23, black 11.
function copy(s) { return JSON.parse(JSON.stringify(s)); }
function initial(variant) {
    const points = Array(24).fill(0);
    [[23,2],[12,5],[7,3],[5,5],[0,-2],[11,-5],[16,-3],[18,-5]].forEach(p => { points[p[0]] = p[1]; });
    if (variant === 'long') { points.fill(0); points[23]=15; points[11]=-15; }
    return { variant: variant === 'long' ? 'long' : 'short', turns:[0,0], headUsed:0, points, bar: [0,0], off: [0,0], player: 0, dice: [], roll: [], opening: true, winner: null };
}
function distance(s,p,i) { return s.variant === 'long' ? 24-(((p===0?23:11)-i+24)%24) : (p===0?i+1:24-i); }
function head(p) { return p===0?23:11; }
function blockedSix(s,p) {
    const sg=sign(p),other=1-p;let run=0;
    for(let step=0;step<24;step++){
        const i=(head(other)-step+24)%24;run=s.points[i]*sg>0?run+1:0;
        if(run>=6 && !s.off[other] && !s.points.some((n,j)=>n*sg<0 && 24-distance(s,other,j)>step)) return true;
    }
    return false;
}
function sign(p) { return p === 0 ? 1 : -1; }
function home(s) { return !s.bar[s.player] && s.points.every((n,i) => n * sign(s.player) <= 0 || distance(s,s.player,i) <= 6); }
function singles(s, die) {
    const p = s.player, sg = sign(p), out = [];
    if (s.winner !== null) return out;
    const froms = s.bar[p] ? [-1] : s.points.map((n,i) => n*sg > 0 ? i : -1).filter(i => i >= 0);
    froms.forEach(from => {
        const long=s.variant==='long';
        if(long && from===head(p)){
            const limit=s.turns[p]===0 && s.roll[0]===s.roll[1] && [3,4,6].includes(s.roll[0])?2:1;
            if(s.headUsed>=limit)return;
        }
        let to = from === -1 ? (p === 0 ? 24-die : die-1) : from - sg*die;
        if(long)to=distance(s,p,from)<=die?24:(from-die+24)%24;
        if (to < 0 || to > 23) {
            if (from === -1 || !home(s)) return;
            const d = distance(s,p,from);
            if (die !== d && s.points.some((n,i) => n*sg > 0 && distance(s,p,i) > d)) return;
            to = 24;
        } else if (s.points[to]*sg < (long?0:-1)) return;
        if(long){const next=copy(s);next.points[from]-=sg;if(to!==24)next.points[to]+=sg;else next.off[p]++;if(blockedSix(next,p))return;}
        out.push({from, to, die});
    });
    return out;
}
function apply(s,m) {
    const t = copy(s), p = t.player, sg = sign(p);
    if(t.variant==='long' && m.from===head(p))t.headUsed++;
    if (m.from === -1) t.bar[p]--; else t.points[m.from] -= sg;
    if (m.to === 24) t.off[p]++;
    else { if (t.points[m.to] === -sg) { t.bar[1-p]++; t.points[m.to] = 0; } t.points[m.to] += sg; }
    t.dice.splice(t.dice.indexOf(m.die),1);
    if (t.off[p] === 15) { t.winner = p; t.pointsWon = t.off[1-p] ? 1 : t.variant==='long' ? 2 : (t.bar[1-p] || t.points.some((n,i) => n*sg < 0 && distance(t,p,i) <= 6) ? 3 : 2); }
    return t;
}
function depth(s, memo) {
    if (!s.dice.length || s.winner !== null) return 0;
    const key = JSON.stringify([s.points,s.bar,s.off,s.player,s.dice,s.headUsed]);
    if (memo[key] !== undefined) return memo[key];
    let best = 0;
    Array.from(new Set(s.dice)).forEach(d => singles(s,d).forEach(m => { best = Math.max(best,1+depth(apply(s,m),memo)); }));
    memo[key] = best; return best;
}
function legal(s) {
    const memo = {}, best = depth(s,memo);
    if (!best) return [];
    let moves = [];
    Array.from(new Set(s.dice)).forEach(d => singles(s,d).forEach(m => { if (1+depth(apply(s,m),memo) === best) moves.push(m); }));
    if (best === 1) { const high = Math.max.apply(null,moves.map(m => m.die)); moves = moves.filter(m => m.die === high); }
    return moves;
}
function move(s,m) {
    if (!legal(s).some(v => v.from === m.from && v.to === m.to && v.die === m.die)) throw new Error('Недопустимый ход');
    return apply(s,m);
}
function roll(s, die) {
    if (s.winner !== null || s.dice.length || s.roll.length) throw new Error('Сначала завершите ход');
    const t = copy(s); let a = die(), b = die();
    if (![a,b].every(v => Number.isInteger(v) && v >= 1 && v <= 6)) throw new Error('Некорректные кости');
    if (t.opening && a === b) return t;
    if (t.opening) { t.player = a > b ? 0 : 1; t.opening = false; }
    t.roll = [a,b]; t.dice = a === b ? [a,a,a,a] : [a,b]; return t;
}
function finish(s) {
    if (s.opening || !s.roll.length || legal(s).length || s.winner !== null) throw new Error('Ход ещё не закончен');
    const t = copy(s); t.turns[t.player]++; t.headUsed=0; t.player = 1-t.player; t.dice = []; t.roll = []; return t;
}
function pips(s,p) { return s.bar[p]*25 + s.points.reduce((v,n,i) => v + Math.max(0,n*sign(p))*distance(s,p,i),0); }
function ai(s) {
    let best = null, score = -Infinity;
    legal(s).forEach(m => {
        const t = apply(s,m), p = s.player, sg = sign(p);
        const value = (t.winner === p ? 10000 : 0) + t.off[p]*18 - pips(t,p)*0.22 + t.bar[1-p]*12 +
            t.points.reduce((v,n,i) => v + (s.variant==='long' ? (n*sg>0?3:0) : n*sg >= 2 ? (distance(t,p,i)<=6 ? 5 : 2) : n*sg === 1 ? -4 : 0),0);
        if (value > score) { score = value; best = m; }
    });
    return best;
}
function valid(s) {
    if (!s || !Array.isArray(s.points) || s.points.length !== 24 || ![0,1].includes(s.player) || ![null,0,1].includes(s.winner) || typeof s.opening !== 'boolean') return false;
    if (!s.points.every(n => Number.isInteger(n) && Math.abs(n)<=15)) return false;
    if (![s.bar,s.off].every(a => Array.isArray(a) && a.length===2 && a.every(n=>Number.isInteger(n)&&n>=0&&n<=15))) return false;
    if (![s.dice,s.roll].every(a => Array.isArray(a) && a.every(n=>Number.isInteger(n)&&n>=1&&n<=6)) || s.dice.length>4 || ![0,2].includes(s.roll.length)) return false;
    if (![0,1].every(p => s.bar[p]+s.off[p]+s.points.reduce((v,n)=>v+Math.max(0,n*sign(p)),0)===15)) return false;
    if (s.winner !== null && s.off[s.winner] !== 15) return false;
    if (s.winner === null && s.off.some(n=>n===15)) return false;
    if(!['short','long'].includes(s.variant) || !Array.isArray(s.turns) || s.turns.length!==2 || !s.turns.every(n=>Number.isInteger(n)&&n>=0) || !Number.isInteger(s.headUsed) || s.headUsed<0 || s.headUsed>2)return false;
    if(s.variant==='long' && s.bar.some(n=>n!==0))return false;
    if (s.opening) return JSON.stringify(s) === JSON.stringify(initial(s.variant));
    const available = !s.roll.length ? [] : s.roll[0]===s.roll[1] ? Array(4).fill(s.roll[0]) : s.roll.slice();
    return s.dice.every(d=>{ const i=available.indexOf(d); if(i<0)return false; available.splice(i,1); return true; });
}
const api = {initial,copy,legal,move,roll,finish,pips,ai,valid};
if (typeof module !== 'undefined') module.exports = api;
else window.Backgammon = api;
