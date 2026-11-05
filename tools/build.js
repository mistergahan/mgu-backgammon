'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.join(__dirname,'..'),out=path.join(root,'dist');
if(!fs.existsSync(out))fs.mkdirSync(out);
const entries=JSON.parse(fs.readFileSync(path.join(root,'mgu-repo.json'),'utf8')).components;
const components=entries.map(entry=>{
 const app=path.join(root,entry.path),manifest=JSON.parse(fs.readFileSync(path.join(app,'mgu-app.json'),'utf8'));
 const file=manifest.id+'@'+manifest.version+'.tgz';
 require('./oap_link.js').packSource(app,path.join(out,file));
 const bytes=fs.readFileSync(path.join(out,file));
 const prefix=entry.id==='dk_tetris'?'tetris-':'';
 const html=fs.readFileSync(path.join(root,prefix+'preview-template.html'),'utf8').replace('<!-- MODULES -->',['engine','game','board'].map(n=>'<script>\n'+fs.readFileSync(path.join(app,'src',n+'.js'),'utf8')+'\n</script>').join('\n'));
 fs.writeFileSync(path.join(root,prefix+'preview.html'),html);
 return {id:manifest.id,kind:'app',title:entry.title,description:entry.description,version:manifest.version,build:'unit',mguHmi:entry.mguHmi,uninstallable:true,artifact:{name:file,url:file,size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}};
});
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({schema:2,components},null,2)+'\n');
console.log('Built '+components.length+' source packages, shared catalog and standalone previews. No BMW SDK included.');
