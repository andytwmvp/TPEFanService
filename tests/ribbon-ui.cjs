const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const mobile of [false,true]) {
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1100,height:760},hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replaceAll('requestAnimationFrame(frame);','').replace('})();\n</script>','window.uiTest={G2,RIBBON,startGame,ribbonStartPlay,ribbonPhysicsStep,ribbonTick,finishRibbonGame,closeRibbonSummary,renderer,scene,camera,placePerformers,updateCamera};\n})();\n</script>');
 await page.route('**/TPEFanService/',r=>r.fulfill({body:html,contentType:'text/html'}));await page.route('**/ribbon-world.js',r=>r.fulfill({body:fs.readFileSync(path.join(root,'ribbon-world.js')),contentType:'application/javascript'}));
 const three=process.env.THREE_PATH||require.resolve('three/build/three.min.js');await page.route('**/three.min.js',r=>r.fulfill({body:fs.readFileSync(three),contentType:'application/javascript'}));
 await page.goto('http://ribbon.test/TPEFanService/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.uiTest);
 assert.equal(await page.locator('#ribbonStart').isVisible(),false);
 await page.locator('#gStart').click();assert(await page.locator('#gamePicker').isVisible());
 await page.locator('#gamePickerCancel').click();assert.equal(await page.locator('#gamePicker').isVisible(),false);
 await page.locator('#gStart').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#gamePicker').isVisible(),false);
 await page.locator('#gStart').click();await page.locator('#fanStart').click();
 assert.equal(await page.evaluate(()=>uiTest.G2.phase),'countdown');assert.equal(await page.locator('#gamePicker').isVisible(),false);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.uiTest);
 await page.locator('#gStart').click();await page.locator('#ribbonStart').click();await page.evaluate(()=>uiTest.ribbonStartPlay(performance.now()));
 const box=await page.locator('#gl').boundingBox(),power=await page.evaluate(()=>uiTest.RIBBON.window.mid),speed=.5+6.5*Math.pow(power/1.35,4/3),travel=Math.max(.08,.025*speed),duration=travel/speed,x=box.x+box.width*.5,y=box.y+box.height*.85,end=y-box.height*travel;
 await page.evaluate(()=>{window.inputEvents=[];for(const name of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(name,e=>inputEvents.push({type:e.type,t:e.timeStamp,x:e.clientX,y:e.clientY,primary:e.isPrimary,target:e.target.id}),true)});
 const cdp=await page.context().newCDPSession(page);const time=Date.now()/1000;
 if(mobile){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}],timestamp:time});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:end,id:1}],timestamp:time+duration*.75});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[],timestamp:time+duration});}
 else {await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1,timestamp:time});await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y:end,button:'left',buttons:1,timestamp:time+duration*.75});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y:end,button:'left',buttons:0,clickCount:1,timestamp:time+duration});}
 if(!await page.evaluate(()=>!!uiTest.RIBBON.flight)) {console.log('input diagnostics',mobile,box,await page.evaluate(()=>({phase:uiTest.RIBBON.phase,gesture:uiTest.RIBBON.gesture,hint:ribbonHint.textContent,power:uiTest.RIBBON.power,events:window.inputEvents})));await page.screenshot({path:'/workspace/mobile-failure.png'});}
 assert(await page.evaluate(()=>!!uiTest.RIBBON.flight),'native swipe launches');
 await page.evaluate(()=>{const t=uiTest,f=t.RIBBON.flight;for(let i=0;i<960&&!f.resolved;i++)t.ribbonPhysicsStep(f,1/120,performance.now());t.ribbonTick(performance.now());t.renderer.render(t.scene,t.camera)});
 assert.equal(await page.evaluate(()=>uiTest.RIBBON.attempts),1);assert.equal(await page.evaluate(()=>uiTest.RIBBON.hits),1,'native calibrated swipe hits');
 const name=mobile?'mobile':'desktop';fs.mkdirSync(path.join(root,'tests/artifacts'),{recursive:true});await page.screenshot({path:path.join(root,'tests/artifacts',name+'-play.png')});
 await page.locator('#ribbonStop').click();await page.evaluate(()=>{uiTest.placePerformers(0);uiTest.updateCamera();for(let i=0;i<190;i++)uiTest.ribbonTick(uiTest.RIBBON.lastFrame+17);uiTest.renderer.render(uiTest.scene,uiTest.camera)});
 await page.locator('#ribbonExport').click();assert(await page.locator('#ribbonPhoto').isVisible());assert((await page.locator('#ribbonExportStatus').innerText()).includes('合照已產生'));
 await page.screenshot({path:path.join(root,'tests/artifacts',name+'-result.png')});
 await page.evaluate(()=>{window.savedToDataURL=HTMLCanvasElement.prototype.toDataURL;HTMLCanvasElement.prototype.toDataURL=function(){throw Error('injected export failure')}});
 await page.locator('#ribbonExport').click();assert((await page.locator('#ribbonExportStatus').innerText()).includes('無法產生合照'));
 await page.evaluate(()=>{HTMLCanvasElement.prototype.toDataURL=window.savedToDataURL});
 await page.locator('#ribbonAgain').click();await page.evaluate(()=>uiTest.ribbonStartPlay(performance.now()));
 // Touch cancellation and second-finger input must never throw.
 await page.evaluate(()=>{const canvas=document.getElementById('gl'),rect=canvas.getBoundingClientRect();const opts={bubbles:true,pointerId:41,pointerType:'touch',isPrimary:true,clientX:rect.x+rect.width/2,clientY:rect.y+rect.height*.8};canvas.dispatchEvent(new PointerEvent('pointerdown',opts));canvas.dispatchEvent(new PointerEvent('pointerdown',{...opts,pointerId:42,isPrimary:false}));canvas.dispatchEvent(new PointerEvent('pointercancel',opts));});
 assert(await page.evaluate(()=>!uiTest.RIBBON.flight&&!uiTest.RIBBON.gesture));
 await page.locator('#ribbonStop').click();await page.locator('#ribbonClose').click();assert(await page.locator('#startPanel').isVisible());assert.equal(await page.evaluate(()=>uiTest.RIBBON.settled.length),0);assert.deepEqual(errors,[]);
 console.log(name+': game picker, both games, cancel / Escape; native swipe, one score, result render, PNG export, replay, multitouch/cancel and cleanup passed');await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
