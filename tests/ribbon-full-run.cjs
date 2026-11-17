// Entire thirty-throw game: real shared physics and normal round/target transitions.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replaceAll('requestAnimationFrame(frame);','').replace('})();\n</script>','window.fullRun={RIBBON,startGame,ribbonStartPlay,ribbonLaunch,ribbonPhysicsStep,ribbonTick,closeRibbonSummary};\n})();\n</script>');
 await page.route('**/TPEFanService/',r=>r.fulfill({body:html,contentType:'text/html'}));for(const file of ['ribbon-world.js','ribbon-records.js'])await page.route('**/'+file,r=>r.fulfill({body:fs.readFileSync(path.join(root,file)),contentType:'application/javascript'}));await page.route('**/three.min.js',r=>r.fulfill({body:fs.readFileSync(require.resolve('three/build/three.min.js')),contentType:'application/javascript'}));await page.goto('http://ribbon.test/TPEFanService/');await page.waitForFunction(()=>window.fullRun);
 const result=await page.evaluate(async()=>{const t=fullRun,r=t.RIBBON,shots=[];t.startGame('ribbon');await t.ribbonStartPlay(performance.now());
  for(let i=0;i<30;i++){
   if(r.phase!=='play')throw Error('not ready before throw '+i);const slot=r.slot,zone=r.thrower.zone;t.ribbonLaunch(r.window.mid,0,performance.now());const f=r.flight;if(!f)throw Error('visible valid throw rejected');for(let n=0;n<960&&!f.resolved;n++)t.ribbonPhysicsStep(f,1/120,performance.now());if(!f.resolved||r.hits!==i+1||r.attempts!==i+1)throw Error('preview / real hit mismatch at '+i);
   shots.push({throw:i+1,slot,zone,phase:r.phase});if(i<29&&r.phase!=='play')throw Error('round ended too early');if(i===29&&(r.phase!=='resultWait'||!r.cleared))throw Error('final round not cleared');
   t.ribbonTick(Math.max(f.removeAt,r.nextAt)+1);while(r.phase==='selecting')await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(r.phase!=='result'||r.results.length!==30)throw Error('last result lost');const summaries=Array.from(document.querySelectorAll('#ribbonRoundResults p'),e=>e.textContent);const out={attempts:r.attempts,hits:r.hits,cleared:r.cleared,shots,summaries};t.closeRibbonSummary();return out;
 });console.log(JSON.stringify(result,null,2));assert.equal(result.hits,30);assert(new Set(result.shots.map(s=>s.slot)).size===14);assert.deepEqual(new Set(result.shots.map(s=>s.zone)),new Set(['front','left','right']));assert(result.summaries.every(s=>s.includes('10/10')&&s.includes('過關')));assert.deepEqual(errors,[]);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
