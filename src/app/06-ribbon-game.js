  var ribbonRecords;
  try {ribbonRecords=RibbonRecords.create(window.localStorage);}
  catch(error) {ribbonRecords=RibbonRecords.create({getItem:function(){return null;},setItem:function(){throw error;}});}
  var RIBBON = {
    active: false, phase: "idle", attempts: 0, hits: 0, perfect: 0, misses: 0,
    combo: 0, bestCombo: 0, score: 0, results: [], targets: [], used: new Set(),
    target: null, flight: null, settled: [], window: null, gesture: null, nextAt: 0, cdStart: 0, lastCd: 0,
    lastFrame: 0, pausedAt: 0, finishReason: "", color: "#f2b25c", power: 0
  };
  var ribbonMark = $("ribbonTargetMark"), ribbonPreview = $("ribbonPreview");
  var ribbonCtx = ribbonPreview.getContext("2d"), ribbonWorld = new THREE.Vector3();
  var ribbonProject = new THREE.Vector3(), ribbonHead = new THREE.Vector3();
  var RIBBON_MAX = 200, RIBBON_SEGMENT = 0.12, RIBBON_DT = 1 / 120;
  var RIBBON_PHYSICS = { g: 9.8, air: 1.2, tapeLen: 30, rollMass: 0.025, rollCdA: 0.0013, pullForce: 0.02, liftA: 0.005, dragN: 11, dragT: 0.4, flutter: 0.45, inherit: 0.08, rollR: 0.03, vMin: 2, vMax: 9.4, elev0: 6, elev1: 32, yawGain: 0.25, yawDead: 2, tiltGain: 1.2, wildFrom: 50, reachR: 0.36, reachUp: 0.45, perfect: 0.3 };
  var RIBBON_ROUNDS=[{name:"第一輪",hits:5},{name:"挑戰輪",hits:7},{name:"決勝輪",hits:null}],RIBBON_ROUND_SIZE=10;
  function ribbonPrepareThrower() {
    var slot = RIBBON.order[RIBBON.attempts % RIBBON.order.length];
    RIBBON.slot = slot;
    G2.member = RIBBON.roster[slot];
    RIBBON.targets = seats.filter(isTarget);
    placePerformers(0);
    var performer = performers[slot], x = performer ? performer.g.position.x : 0, z = performer ? performer.g.position.z : STAGE_Z0 - .8;
    var h = S.perfH / 100;
    if(performer) performer.g.updateMatrixWorld(true);
    RIBBON.thrower = RIBBON.throwers ? RIBBON.throwers[slot] : {
      slot:slot,position:new THREE.Vector3(x,S.stageH,z),baseForAim:true,heading:0,
      eye:new THREE.Vector3(x,S.stageH+h*.935,z+.1),
      release:performer ? performer.elR.localToWorld(new THREE.Vector3(0,-.245,0)) : new THREE.Vector3(x,S.stageH+h*.97,z+.45),
      hold:performer ? performer.elL.localToWorld(new THREE.Vector3(0,-.245,0)) : new THREE.Vector3(x+.16,S.stageH+h*.62,z+.3)
    };
    var member = ribbonCastMember(G2.team,G2.member);
    ribbonLockInterception();RIBBON.color=ribbonThrowColor(member,RIBBON.attempts);
    placePerformers(0);if(RIBBON.world&&RIBBON.world.setActors)RIBBON.world.setActors(performers);
  }
  function ribbonAimThrower(thrower,target) {
    if(!thrower.baseForAim)return thrower;
    headWorld(target,ribbonHead);
    var heading=Math.atan2(ribbonHead.x-thrower.position.x,ribbonHead.z-thrower.position.z);
    function turned(point){return point.clone().sub(thrower.position).applyAxisAngle(YAX,heading).add(thrower.position);}
    return {slot:thrower.slot,position:thrower.position,zone:thrower.zone||"front",station:thrower.station||"front",heading:heading,baseForAim:false,eye:turned(thrower.eye),release:turned(thrower.release),hold:turned(thrower.hold)};
  }
  function ribbonFrontPositions() {
    var aRow=seats.filter(function(s){return !s.side&&s.row==="A";}),edge=Math.min(STAGE_W/2-.5,Math.max.apply(null,aRow.map(function(s){return Math.abs(s.pos.x);}))),intervals=[[-edge,edge]],clearance=PILLAR_W/2+Math.max(.25,.24*S.perfH/157);
    PILLARS.forEach(function(p){
      var next=[];intervals.forEach(function(range){
        if(p.x+clearance<=range[0] || p.x-clearance>=range[1]){next.push(range);return;}
        if(range[0]<p.x-clearance)next.push([range[0],p.x-clearance]);
        if(range[1]>p.x+clearance)next.push([p.x+clearance,range[1]]);
      });intervals=next;
    });
    var length=intervals.reduce(function(sum,range){return sum+range[1]-range[0];},0);
    return Array.from({length:6},function(_,i){
      var remaining=i*length/5;
      for(var k=0;k<intervals.length;k++){var range=intervals[k],size=range[1]-range[0];if(remaining<=size||k===intervals.length-1)return range[0]+remaining;remaining-=size;}
    });
  }
  function ribbonTargetZone(target) {return target.side?(target.pos.x<0?"left":"right"):"front";}
  function ribbonMakeStations() {
    var stations=ribbonFrontPositions().map(function(x,i){return {zone:"front",station:"front:"+i,position:new THREE.Vector3(x,S.stageH,STAGE_Z0-.8),heading:0};});
    var rear=SIDES.reduce(function(z,row){return Math.min(z,row[2]-(row[3]-1)*row[4]);},Infinity)+.17;
    ["left","right"].forEach(function(zone){for(var i=0;i<4;i++)stations.push({zone:zone,station:zone+":"+i,
      position:new THREE.Vector3((zone==="left"?-1:1)*(STAGE_W/2-2.08),S.stageH,STAGE_Z0-1.65+i*(rear-(STAGE_Z0-1.65))/3),heading:zone==="left"?-Math.PI/2:Math.PI/2});});
    return stations;
  }
  function ribbonStationsFor(slot,target) {return ribbonTargetZone(target)===RIBBON.stations[slot].zone?[RIBBON.throwers[slot]]:[];}
  function ribbonCastMember(team,member) {return TEAMS[team].members[member]||{n:"虛擬站位",nick:"舞台演出",c:["#f2b25c"]};}
  function ribbonCastColor(member) {return (member.c||[]).find(function(color){return /^#[0-9a-f]{6}$/i.test(color);})||"#f2b25c";}
  var RIBBON_PALETTE=["#ff4388","#ff9235","#f6c72f","#96cc32","#28bd88","#20bbd7","#397ee8","#7956d9","#bf58d6","#ee5d58","#3aaeb1","#e7e9f7"];
  function ribbonThrowColor(member,attempt) {
    if(RIBBON.throwColors[attempt])return RIBBON.throwColors[attempt];
    var color;
    if(attempt%3===0){var theme=new THREE.Color(ribbonCastColor(member)),hsl={};theme.getHSL(hsl);if(hsl.s>.08)theme.setHSL(hsl.h,Math.max(.7,hsl.s),.55);color="#"+theme.getHexString();}
    else color=RIBBON_PALETTE[(RIBBON.paletteOffset+attempt*5)%RIBBON_PALETTE.length];
    if(color===RIBBON.throwColors[attempt-1])color=RIBBON_PALETTE[(RIBBON.paletteOffset+attempt*5+3)%RIBBON_PALETTE.length];
    RIBBON.throwColors[attempt]=color;return color;
  }

  function ribbonAddCast() {
    var shared=new Set();
    scene.traverse(function(o){if(o.geometry)shared.add(o.geometry);var materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(function(m){if(m){shared.add(m);Object.keys(m).forEach(function(k){if(m[k]&&m[k].isTexture)shared.add(m[k]);});}});});
    RIBBON.castShared=shared;RIBBON.originalCastCount=performers.length;
    while(performers.length<14){var p=makePerformer(performers.length);performers.push(p);perfGroup.add(p.g);}
  }
  function ribbonRestoreCast() {
    if(!RIBBON.castShared)return;
    var owned=new Set(),shared=RIBBON.castShared;
    performers.splice(RIBBON.originalCastCount).forEach(function(p){perfGroup.remove(p.g);p.g.traverse(function(o){
      if(o.geometry&&!shared.has(o.geometry))owned.add(o.geometry);
      (Array.isArray(o.material)?o.material:[o.material]).forEach(function(m){if(m&&!shared.has(m)){owned.add(m);Object.keys(m).forEach(function(k){if(m[k]&&m[k].isTexture&&!shared.has(m[k]))owned.add(m[k]);});}});
    });});
    owned.forEach(function(resource){resource.dispose();});RIBBON.castShared=null;RIBBON.stations=null;RIBBON.heldThrowers={};
    placePerformers(0);
  }
  function ribbonReceiverSnapshot(){return RIBBON.crowd?Array.from(RIBBON.crowd.entries.values()).filter(function(e){return e.caught;}).map(function(e){return e.seat.i;}):[];}
  function ribbonCanReceive(seat,receivers){if(receivers)return !receivers.includes(seat.i);var e=RIBBON.crowd&&RIBBON.crowd.entries.get(seat.i);return !e||!e.caught;}
  function ribbonPickupRowAllowed(seat,point){
    if(!seat.side)return seat.st===0||point.z>=seat.pos.z-ROW_PITCH/2;
    var row=SIDES.find(function(r){return r[0]===seat.row;});return !!row&&(row[6]===0||Math.abs(point.x)>=Math.abs(seat.pos.x)-ROW_PITCH/2);
  }
  function ribbonCandidateSeats() {
    var front = RIBBON.targets.filter(function(s) {
      var row = FRONT.findIndex(function(r) { return r[0] === s.row; });
      return ribbonTargetZone(s)===RIBBON.stations[RIBBON.slot].zone && (s.side || row >= 0 && row <= 2) && s.i !== S.my && ribbonCanReceive(s);
    });
    return front;
  }
  function ribbonSideCandidateOrder(options,slot,random) {
    var station=RIBBON.stations[slot],front=station.zone==="front";
    if(front){
      function angle(s){return Math.abs(Math.atan2(s.pos.x-station.position.x,s.pos.z-station.position.z));}
      var outer=(random===undefined?Math.random():random)>=.92,pool=options.filter(function(s){return outer?angle(s)>Math.PI/4:angle(s)<=Math.PI/4;});
      var rowPick=Math.random(),preferredRow=rowPick<.45?"A":rowPick<.9?"B":"C";
      function rowRank(s){return s.row===preferredRow?0:s.row==="C"?2:1;}
      var ranks=pool.map(function(s){return {seat:s,key:-Math.log(Math.max(1e-9,Math.random()))/(outer?Math.exp(-(angle(s)-Math.PI/4)/.35):1)};});
      var fans=new Set(RIBBON.targets.map(function(s){return s.i;}));ranks.sort(function(a,b){return rowRank(a.seat)-rowRank(b.seat)||Number(RIBBON.used.has(a.seat.i))-Number(RIBBON.used.has(b.seat.i))||Number(!fans.has(a.seat.i))-Number(!fans.has(b.seat.i))||a.key-b.key;});
      var chosen=new Set(pool.map(function(s){return s.i;}));return ranks.map(function(r){return r.seat;}).concat(options.filter(function(s){return !chosen.has(s.i);}));
    }
    if((random===undefined?Math.random():random)>=.8)return options;
    var fans=new Set(RIBBON.targets.map(function(s){return s.i;}));
    var direct=options.filter(function(s){return Math.abs(front?Math.atan2(s.pos.x-station.position.x,Math.abs(s.pos.z-station.position.z)):Math.atan2(s.pos.z-station.position.z,Math.abs(s.pos.x-station.position.x)))<=(front?Math.PI/4:Math.PI/6);});
    direct.sort(function(a,b){return Number(RIBBON.used.has(a.i))-Number(RIBBON.used.has(b.i)) || Number(!fans.has(a.i))-Number(!fans.has(b.i)) || Math.abs(a.pos.z-station.position.z)-Math.abs(b.pos.z-station.position.z);});
    var selected=new Set(direct.map(function(s){return s.i;}));return direct.concat(options.filter(function(s){return !selected.has(s.i);}));
  }
  async function ribbonPickTarget(session) {
    var options = ribbonCandidateSeats().filter(function(s) { return !RIBBON.used.has(s.i); });
    if (!options.length) {
      options = ribbonCandidateSeats();
    }
    for(var j=options.length-1;j>0;j--){var swap=Math.floor(Math.random()*(j+1)),item=options[j];options[j]=options[swap];options[swap]=item;}
    var remaining = ribbonCandidateSeats().filter(function(s){ return RIBBON.used.has(s.i) && !options.includes(s); });
    options = options.concat(remaining);
    var included = new Set(options.map(function(s){return s.i;}));
    // Prefer this member's fans, then retry other real spectators as in the reference.
    options = options.concat(seats.filter(function(s){return !included.has(s.i) && s.i!==S.my && ribbonCanReceive(s) && seatOcc(s) && (s.side || s.st<=2) && ribbonTargetZone(s)===RIBBON.stations[RIBBON.slot].zone;}).sort(function(){return Math.random()-.5;}));
    options=ribbonSideCandidateOrder(options,RIBBON.slot);
    if(RIBBON.egg&&RIBBON.egg.armed&&RIBBON.egg.attempt===RIBBON.attempts){var quiet=options.filter(function(s){return !s.light&&!s.fan&&!s.towel&&(G2.member===null||s.oshi===G2.member);}),quietIds=new Set(quiet.map(function(s){return s.i;}));options=quiet.concat(options.filter(function(s){return !quietIds.has(s.i);}));}
    for (var i = 0; i < options.length; i++) {
      var target = options[i];
      var stations=ribbonStationsFor(RIBBON.slot,target);
      for(var station=0;station<stations.length;station++) {
        var context=stations[station],win=await ribbonWindowFor(session,RIBBON.slot,target,context);
        if (!RIBBON.active || RIBBON.session !== session) return null;
        if (win) return {target:target,window:win,thrower:context};
      }
    }
    return null;
  }
  async function ribbonWindowFor(session,slot,target,thrower) {
    if(!RIBBON.active || RIBBON.session!==session||!ribbonCanReceive(target))return null;
    var key=RIBBON.attempts+":"+slot+":"+(thrower.station||"front")+":"+target.i+":"+(RIBBON.world.actorRevision?RIBBON.world.actorRevision():0)+":"+ribbonReceiverSnapshot().join(",")+":"+(RIBBON.challenge?[RIBBON.challenge.active,RIBBON.challenge.seed].join(","):"none"),cache=RIBBON.windowCache,pending=RIBBON.windowTasks;
    if(cache.has(key))return cache.get(key);
    if(pending.has(key))return pending.get(key);
    var task=ribbonFindWindow(session,target,thrower).then(function(win){
      if(RIBBON.active && RIBBON.session===session) {
        cache.set(key,win);
        if(win) {
          if(!target.side && target.st<4)RIBBON.reachableRows[slot*4+target.st]=true;
          if(RIBBON.roster[slot]!==null)ribbonRecords.setAvailable(G2.team,RIBBON.roster[slot],target.row,true);
        }
      }
      return win;
    }).finally(function(){pending.delete(key);});
    pending.set(key,task);return task;
  }
  async function ribbonExploreRecords(session) {
    var contexts=RIBBON.throwers,roster=RIBBON.roster.slice(),team=G2.team;
    var rows='ABCNOPQ';
    for(var slot=0;slot<roster.length;slot++)for(var row=0;row<rows.length;row++) {
      if(!RIBBON.active || RIBBON.session!==session)return;
      if(roster[slot]===null)continue;
      var label=rows[row],context=contexts[slot];
      var candidates=seats.filter(function(s){return s.row===label&&ribbonTargetZone(s)===context.zone&&s.i!==S.my&&seatOcc(s);});
      candidates.sort(function(a,b){return a.pos.distanceToSquared(context.eye)-b.pos.distanceToSquared(context.eye);});
      var found=false,temporary=false;
      for(var i=0;i<candidates.length;i++) {
        if(!ribbonCanReceive(candidates[i])){temporary=true;continue;}
        var win=await ribbonWindowFor(session,slot,candidates[i],context);
        if(!RIBBON.active || RIBBON.session!==session)return;
        if(win){found=true;break;}
      }
      // Holding a ribbon is temporary; it must not erase a reachable collection cell.
      if(found||!temporary)ribbonRecords.setAvailable(team,roster[slot],label,found||'ABC'.includes(label)&&RIBBON.reachableRows[slot*4+'ABC'.indexOf(label)]===true);
    }
    if(!RIBBON.active || RIBBON.session!==session)return;
    RIBBON.recordsReady=true;ribbonRecords.collection(team,roster.filter(function(m){return m!==null;}));ribbonRecords.save();
  }
  function ribbonShowRecords() {
    var inRun=RIBBON.active||RIBBON.phase==="result",team=inRun?G2.team:+$("gTeam").value;
    var start=+$("gMember").value,roster=inRun?RIBBON.roster:Array.from({length:14},function(_,i){return i<TEAMS[team].members.length?(start+i)%TEAMS[team].members.length:null;});
    var summary=ribbonRecords.collection(team,roster.filter(function(m){return m!==null;})),snapshot=ribbonRecords.snapshot();
    $("ribbonRecordSummary").textContent="最高命中 "+snapshot.bestHit+" 次 · 該次完美 "+snapshot.bestPerfect+" 次 · 累計送達 "+snapshot.hits+" 次／完美 "+snapshot.perfects+" 次 · 已探索 "+summary.known+"/"+summary.total+" 格";
    var html='<table class="ribbon-record-grid"><thead><tr><th scope="col">排</th>'+roster.map(function(member){return '<th scope="col"><span>'+esc(ribbonCastMember(team,member).n)+'</span></th>';}).join('')+'</tr></thead><tbody>';
    'ABCDNOPQ'.split('').forEach(function(row){html+='<tr><th scope="row">'+row+(row==='D'?'（歷史）':'')+(SIDE_NAME[row]?'（'+SIDE_NAME[row]+'）':'')+'</th>'+roster.map(function(member){var a=row==='D'?false:ribbonRecords.available(team,member,row),value=row==='D'?ribbonRecords.get(team,member,row):a===false?0:ribbonRecords.get(team,member,row);return '<td class="'+(value===2?'pf':value?'got':a===false?'no':'')+'" aria-label="'+esc(ribbonCastMember(team,member).n)+' '+row+'排 '+(value===2?'完美':value?'命中':row==='D'?'歷史記錄（不列入新收藏）':a===null?'尚未探索':a?'可達':'本次不可達')+'">'+(value===2?'★':value?'●':row==='D'?'—':a===null?'—':a?'○':'×')+'</td>';}).join('')+'</tr>';});
    $("ribbonRecordGrid").innerHTML=html+'</tbody></table>';
    $("ribbonTitles").innerHTML=ribbonRecords.titles.map(function(title){return '<div class="'+(snapshot.titles.includes(title[0])?'on':'')+'">'+esc(title[1])+'<small>'+esc(title[2])+'</small></div>';}).join('');
    $("ribbonStorageStatus").textContent=ribbonRecords.warning();
    if(!$("ribbonRecordDialog").open)$("ribbonRecordDialog").showModal();
  }
  function ribbonFaceTarget() {
    if (!RIBBON.target) return;
    headWorld(RIBBON.target, ribbonWorld);ribbonWorld.y+=.25;
    eyePos(eye);
    S.yaw = Math.atan2(eye.x - ribbonWorld.x, eye.z - ribbonWorld.z);
    S.pitch=Math.atan2(ribbonWorld.y-eye.y,Math.hypot(ribbonWorld.x-eye.x,ribbonWorld.z-eye.z));
    updateCamera();
  }
  function ribbonCandidateVisible(thrower,target,actors) {
    var aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight),base=Math.max(56,Math.min(86,2*Math.atan(Math.tan(34*Math.PI/180)/aspect)*180/Math.PI));
    if(thrower.zone&&thrower.zone!=="front")base=70;
    var view=new THREE.PerspectiveCamera(S.fov*base/IDOL_FOV,aspect,.05,80),point=new THREE.Vector3();
    headWorld(target,point);point.y+=.25;
    if(RIBBON.world.blocked&&RIBBON.world.blocked(thrower.eye,point,thrower.slot,actors))return false;
    view.position.copy(thrower.eye);view.lookAt(point);view.updateMatrixWorld(true);point.copy(thrower.release).project(view);
    return point.z>-1&&point.z<1&&Math.abs(point.x)<.85&&Math.abs(point.y)<.85;
  }
  function ribbonTargetVisible() {
    if(!RIBBON.active || RIBBON.phase!=="play" || !RIBBON.target || !RIBBON.thrower)return false;
    updateCamera();camera.updateMatrixWorld(true);
    headWorld(RIBBON.target,ribbonProject);
    if(RIBBON.world.blocked&&RIBBON.world.blocked(camera.position,ribbonProject,RIBBON.slot))return false;
    ribbonProject.project(camera);
    var w=canvas.clientWidth,h=canvas.clientHeight;
    if(ribbonProject.z<=-1||ribbonProject.z>=1||Math.abs(ribbonProject.x)>1-48/w||Math.abs(ribbonProject.y)>1-48/h)return false;
    var bounds=canvas.getBoundingClientRect(),hud=$("ribbonHud").getBoundingClientRect(),x=bounds.left+(ribbonProject.x+1)*w/2,y=bounds.top+(1-ribbonProject.y)*h/2;
    if(!$("ribbonHud").hidden && x>=hud.left-20 && x<=hud.right+20 && y>=hud.top-20 && y<=hud.bottom+20)return false;
    ribbonHead.copy(RIBBON.thrower.release).project(camera);
    return ribbonHead.z>-1&&ribbonHead.z<1&&Math.abs(ribbonHead.x)<.95&&Math.abs(ribbonHead.y)<.95;
  }
  function ribbonRequireVisibleTarget() {
    if(ribbonTargetVisible())return true;
    ribbonCancelGesture();ribbonSetPower(0);S.fov=IDOL_FOV;ribbonFaceTarget();ribbonUpdateMarker();
    if(!ribbonTargetVisible())ribbonStartPlay(performance.now());
    toast("目標不在可投擲視線內，這次未投出；已重新對準或準備新目標。");return false;
  }
  async function ribbonYieldSearch(session) {
    await new Promise(function(resolve){setTimeout(resolve,0)});
    while(document.hidden && RIBBON.active && RIBBON.session===session)
      await new Promise(function(resolve){setTimeout(resolve,100)});
  }
  async function ribbonFindWindow(session, target, thrower) {
    if(!ribbonCanReceive(target))return null;
    thrower=ribbonAimThrower(thrower || RIBBON.thrower,target);
    var receivers=ribbonReceiverSnapshot();
    var actors=RIBBON.world.snapshotActors?RIBBON.world.snapshotActors():null,challenge=RIBBON.challenge?Object.assign({},RIBBON.challenge):null,bodies=RIBBON.world.snapshotBodies?RIBBON.world.snapshotBodies():null;
    if(!ribbonCandidateVisible(thrower,target,actors))return null;
    headWorld(target,ribbonHead);
    if(RIBBON.world.blocked && RIBBON.world.blocked(thrower.eye,ribbonHead,thrower.slot,actors))return null;
    var searchState={receivers:receivers,bodies:bodies,challenge:challenge};
    var best = [], run = [], danger = 1.35;
    for (var i = 0; i <= 120; i++) {
      if(i % 8 === 0) {
        await ribbonYieldSearch(session);
        if(!RIBBON.active || RIBBON.session !== session) return null;
      }
      var power = 1.35 * i / 120, shot = ribbonBuildLaunch(power, 0, target, thrower);
      var f = {receivers:receivers,bodies:bodies,interceptors:ribbonInterceptors(shot,target,thrower,challenge), owner:thrower.slot,actors:actors,roll: shot.origin.clone(), velocity: shot.velocity.clone(), tilt: shot.tilt, paid: 0, apex: shot.origin.y, hit: false, time: 0 };
      var outcome = null;
      for (var k = 0; k < 960; k++) {
        var result = ribbonStepRoll(f, target);
        outcome = result.caught;
        if (result.done) break;
      }
      if (f.hit && power < danger) danger = power;
      if (outcome && outcome.seat === target) {
        run.push({ u: power, perfect: outcome.distance < RIBBON_PHYSICS.perfect && !outcome.pickup && !f.hit && !f.snag });
        if(run.length > best.length) best = run.slice();
      } else run = [];
    }
    if (best.length < 5) return null;
    var pf = [], pfRun = [];
    best.forEach(function(v){
      if(v.perfect) { pfRun.push(v); if(pfRun.length > pf.length) pf = pfRun.slice(); }
      else pfRun = [];
    });
    var lo = best[0].u, hi = best[best.length-1].u, mid=(lo+hi)/2;
    var aimLo=0, aimHi=0;
    for (var angle=-1;angle>=-30;angle--) {
      if(angle%4===0) {await ribbonYieldSearch(session);if(!RIBBON.active || RIBBON.session!==session)return null;}
      if (!ribbonPredict(mid,angle,target,thrower,actors,searchState).ok) break;
      aimLo=angle;
    }
    for (var angle=1;angle<=30;angle++) {
      if(angle%4===0) {await ribbonYieldSearch(session);if(!RIBBON.active || RIBBON.session!==session)return null;}
      if (!ribbonPredict(mid,angle,target,thrower,actors,searchState).ok) break;
      aimHi=angle;
    }
    if(aimLo > -3 || aimHi < 3) return null;
    return { lo:lo, hi:hi, mid:mid, aimLo:aimLo, aimHi:aimHi, danger:danger, pfLo: pf.length ? pf[0].u : null, pfHi: pf.length ? pf[pf.length-1].u : null };
  }
  function ribbonPredict(power,angle,target,thrower,actors,state) {
    var shot=ribbonBuildLaunch(power,angle,target,thrower);
    var f={receivers:state?state.receivers:ribbonReceiverSnapshot(),bodies:state?state.bodies:(RIBBON.world.snapshotBodies?RIBBON.world.snapshotBodies():null),interceptors:ribbonInterceptors(shot,target,thrower||RIBBON.thrower,state?state.challenge:undefined),owner:(thrower||RIBBON.thrower).slot,actors:actors||(RIBBON.world.snapshotActors?RIBBON.world.snapshotActors():null),roll:shot.origin.clone(),velocity:shot.velocity.clone(),tilt:shot.tilt,paid:0,apex:shot.origin.y,hit:false,time:0}, result;
    for(var i=0;i<960;i++){result=ribbonStepRoll(f,target);if(result.done)break;}
    return {ok:!!result.caught && result.caught.seat===target,perfect:!!result.caught && result.caught.seat===target && !f.hit && !result.caught.pickup && result.caught.distance<RIBBON_PHYSICS.perfect,hit:f.hit};
  }

  var ribbonPowerOf = RibbonInput.powerOf;
  function ribbonMetrics(g, last) {
    return RibbonInput.metrics(g, last, $("view").clientHeight);
  }
  function ribbonAimOffset(deg) {
    return RibbonInput.aimOffset(deg, RIBBON_PHYSICS);
  }
  function ribbonBuildLaunch(power, alpha, targetSeat, thrower) {
    targetSeat = targetSeat || RIBBON.target;
    if (!targetSeat) return null;
    headWorld(targetSeat, ribbonWorld);
    var target = ribbonWorld.clone();
    target.y += 0.22;
    var origin = ribbonAimThrower(thrower || RIBBON.thrower,targetSeat).release.clone();
    var dx = target.x - origin.x, dz = target.z - origin.z, dist = Math.hypot(dx, dz) || 1;
    var fx = dx / dist, fz = dz / dist, rawAlpha = alpha || 0, a = ribbonAimOffset(rawAlpha);
    var hx = fx * Math.cos(a) - fz * Math.sin(a), hz = fz * Math.cos(a) + fx * Math.sin(a);
    var u = Math.max(0, Math.min(1.35, power)), speed = RIBBON_PHYSICS.vMin + (RIBBON_PHYSICS.vMax - RIBBON_PHYSICS.vMin) * u;
    var elev = (RIBBON_PHYSICS.elev0 + RIBBON_PHYSICS.elev1 * u) * Math.PI / 180;
    var sign = Math.sign(rawAlpha), mag = Math.min(180, Math.abs(rawAlpha));
    var off = sign * Math.max(0, Math.min(mag, RIBBON_PHYSICS.wildFrom) - RIBBON_PHYSICS.yawDead) * Math.PI / 180;
    return { origin: origin, velocity: new THREE.Vector3(hx * speed * Math.cos(elev), speed * Math.sin(elev), hz * speed * Math.cos(elev)), tilt: off * RIBBON_PHYSICS.tiltGain };
  }
  function ribbonSetPower(power) {
    RIBBON.power = Math.max(0, Math.min(1.35, power || 0));
    var pct = 100 * RIBBON.power / 1.35;
    var win = RIBBON.phase === "play" ? RIBBON.window : null, band = $("ribbonPowerBand"), pf = $("ribbonPerfectBand");
    band.hidden = !win;
    pf.hidden = !win || win.pfLo === null;
    if(win) { band.style.left = (win.lo/1.35*100)+"%"; band.style.width = ((win.hi-win.lo)/1.35*100)+"%";
      if(win.pfLo !== null) {pf.style.left=(win.pfLo/1.35*100)+"%";pf.style.width=(Math.max(.012,win.pfHi-win.pfLo)/1.35*100)+"%";} }
    if (RIBBON.gesture && win && RIBBON.target) {
      var metrics=ribbonMetrics(RIBBON.gesture), predicted=ribbonPredict(RIBBON.power,metrics.alpha,RIBBON.target);
      $("ribbonHint").textContent=predicted.ok ? (predicted.perfect?"★ 這個力度與方向可完美接取":"○ 這個力度與方向可命中") : predicted.hit ? "⚠ 會碰到障礙物，請減輕力度或調整方向" : RIBBON.power<win.lo ? "力度偏弱，請更快速向上滑動" : RIBBON.power>win.hi ? "力度偏強，請減輕力度" : "方向偏離，請向上直滑或調整左右角度";
    }
    $("ribbonPowerFill").style.width = pct.toFixed(1) + "%";
    $("ribbonPowerFill").parentNode.setAttribute("aria-valuenow", String(Math.round(pct)));
  }
  function ribbonUpdateHud() {
    var member = ribbonCastMember(G2.team,G2.member);
    $("ribbonWho").textContent = "你是 " + member.n + "（" + member.nick + "）";
    var completed=RIBBON.attempts>0&&(RIBBON.flight&&RIBBON.flight.resolved||RIBBON.phase==="resultWait");
    var base=(RIBBON.roundIndex||0)*10,rule=RIBBON_ROUNDS[RIBBON.roundIndex||0];
    $("ribbonRound").textContent=rule.name+"・"+(rule.hits===null?"完成十投":"十投至少 "+rule.hits+" 中")+"（本輪 "+RIBBON.results.slice(base).filter(function(r){return r.ok;}).length+" 中）";
    $("ribbonTargetText").textContent = RIBBON.target ? "目標觀眾：" + seatLabel(RIBBON.target) + " · " + (RIBBON.thrower.zone==="left"?"舞台左側站位":RIBBON.thrower.zone==="right"?"舞台右側站位":"舞台正面站位") : "正在尋找下一位目標…";
    $("ribbonAttempt").textContent = String(RIBBON.attempts);
    $("ribbonHits").textContent = String(RIBBON.hits);
    $("ribbonPerfect").textContent = String(RIBBON.perfect);
    $("ribbonCombo").textContent = String(RIBBON.combo);
    $("ribbonDots").style.setProperty("--ribbon-color", RIBBON.color);
    var inRound = RIBBON.attempts-base, dots = [];
    for (var i = 0; i < RIBBON_ROUND_SIZE; i++) {
      var cls = i < inRound ? (RIBBON.results[base + i] && RIBBON.results[base + i].ok ? "hit" : "miss") : i === inRound && RIBBON.phase === "play" && !completed ? "now" : "";
      dots.push('<i class="' + cls + '"></i>');
    }
    $("ribbonDots").innerHTML = dots.join("");
    $("ribbonHint").textContent=RIBBON.phase==="selecting"?"正在準備下一投，請稍候…":rule.name+(rule.hits===null?"完成十投後結算，不設命中門檻":"十投至少 "+rule.hits+" 中")+"；綠色可命中，黃色可完美接取。";
    if(RIBBON.roundIndex>=1&&RIBBON.challenge)$("ribbonHint").textContent+=" 前排攔截機率約 "+Math.round(RIBBON.challenge.chance*100)+"%。";
    if (RIBBON.phase === "play" && RIBBON.window) $("ribbonHint").textContent += " 直滑中央力度時，方向容許 " + RIBBON.window.aimLo + "°～+" + RIBBON.window.aimHi + "°。";
  }
  function ribbonUpdateMarker() {
    if(!ribbonTargetVisible()){ribbonMark.hidden=true;return;}
    var w=$("view").clientWidth,h=$("view").clientHeight;
    var x = (ribbonProject.x + 1) * 0.5 * w, y = (1 - ribbonProject.y) * 0.5 * h;
    ribbonMark.style.left = x + "px";
    ribbonMark.style.top = y + "px";
    ribbonMark.querySelector("span").textContent = "目標 · " + seatLabel(RIBBON.target);
    ribbonMark.hidden = false;
  }
  function ribbonMakeSpool(color) {
    var material=new THREE.MeshLambertMaterial({color:color,emissive:color,emissiveIntensity:.35});
    var spool=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.02,20),material);
    var holeGeometry=new THREE.CircleGeometry(.012,16),holeMaterial=new THREE.MeshBasicMaterial({color:0x17121b,side:THREE.DoubleSide});
    for(var side=-1;side<=1;side+=2){var hole=new THREE.Mesh(holeGeometry,holeMaterial);hole.rotation.x=Math.PI/2;hole.position.y=side*.0105;spool.add(hole);}
    return spool;
  }
  function ribbonDisposeSpool(spool) {
    if(!spool)return;scene.remove(spool);
    var geometries=new Set(),materials=new Set();spool.traverse(function(object){if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});
    geometries.forEach(function(g){g.dispose();});materials.forEach(function(m){m.dispose();});
  }
  function ribbonDisposeHeld() {ribbonDisposeSpool(RIBBON.heldSpool);RIBBON.heldSpool=null;}
  var ribbonHeldForward=new THREE.Vector3(),ribbonHeldRight=new THREE.Vector3(),ribbonHeldUp=new THREE.Vector3();
  function ribbonTickHeld(dt) {
    var spool=RIBBON.heldSpool;if(!spool)return;
    spool.visible=RIBBON.active&&RIBBON.phase==="play"&&!RIBBON.flight;
    if(!spool.visible)return;
    camera.updateMatrixWorld(true);
    ribbonHeldForward.set(0,0,-1).applyQuaternion(camera.quaternion);
    ribbonHeldRight.set(1,0,0).applyQuaternion(camera.quaternion);
    ribbonHeldUp.set(0,1,0).applyQuaternion(camera.quaternion);
    var gesture=RIBBON.gesture,last=gesture&&gesture.points[gesture.points.length-1],height=Math.max(1,canvas.clientHeight);
    var dx=last?(last.x-gesture.x0)/height:0,dy=last?(gesture.y0-last.y)/height:0;
    var drop=Math.min(.27,.42*Math.tan(camera.fov*Math.PI/360)*.7);
    spool.position.copy(camera.position).addScaledVector(ribbonHeldForward,.42).addScaledVector(ribbonHeldUp,-drop+.34*dy).addScaledVector(ribbonHeldRight,.3*dx);
    spool.quaternion.copy(camera.quaternion);spool.rotateX(Math.PI/2-6*dy);spool.rotateZ(.25*Math.max(0,1-6*dy));
    RIBBON.heldAge=(RIBBON.heldAge||0)+dt;spool.scale.setScalar(Math.max(.01,Math.min(1,RIBBON.heldAge/.15)));
  }
  function ribbonMakeTrail(color) {
    var geo = new THREE.BufferGeometry(), positions = new Float32Array(RIBBON_MAX * 2 * 3), colors = new Float32Array(RIBBON_MAX * 2 * 3), indices = [];
    for (var i = 0; i < RIBBON_MAX - 1; i++) {
      var j = i * 2;
      indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(indices);
    var mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.94, depthWrite: false, toneMapped: false });
    var meshTape = new THREE.Mesh(geo, mat);
    meshTape.frustumCulled = false;
    scene.add(meshTape);
    var c = new THREE.Color(color);
    var spool = ribbonMakeSpool(color);
    scene.add(spool);
    return { geo: geo, mesh: meshTape, rollMesh:spool, color: c, nodes: [], seed:Math.random()*100 };
  }
  function ribbonAddPoint(f, p, velocity) {
    var q = p.clone(), prev = q.clone();
    if (velocity) prev.addScaledVector(velocity, -RIBBON_PHYSICS.inherit * RIBBON_DT);
    f.nodes.push({ p: q, prev: prev });
  }
  function ribbonAddTrail(f, end) {
    var nodes = f.nodes;
    while (nodes.length < RIBBON_MAX) {
      var base = nodes[nodes.length - 2].p, delta = end.clone().sub(base), d = delta.length();
      if (d < RIBBON_SEGMENT * 1.5) break;
      var q = base.clone().addScaledVector(delta, RIBBON_SEGMENT / d);
      var tail = nodes[nodes.length - 1];
      tail.p.copy(q); tail.prev.copy(q).addScaledVector(f.velocity, -RIBBON_PHYSICS.inherit * RIBBON_DT);
      ribbonAddPoint(f, end, f.velocity);
    }
    nodes[nodes.length - 1].p.copy(end);
    nodes[nodes.length - 1].prev.copy(end);
  }
  function ribbonPrepareDrop(f) {
    var route=RIBBON.world.dropRoute(f.finaleFrom,f.roll,S.stageH+.012);f.dropRoute=route;
    var rest=[route.floor].concat(route.guides,[f.roll]),points=[f.anchor].concat(route.guides,[f.roll]),counts=[],total=0;
    for(var i=1;i<rest.length;i++){var n=Math.max(1,Math.ceil(Math.max(rest[i-1].distanceTo(rest[i]),points[i-1].distanceTo(points[i]))/RIBBON_SEGMENT));counts.push(n);total+=n;}
    counts[counts.length-1]+=Math.max(0,f.nodes.length-1-total);total=counts.reduce(function(a,b){return a+b;},0);
    if(total>=RIBBON_MAX){counts[counts.length-1]-=total-RIBBON_MAX+1;total=RIBBON_MAX-1;}
    while(f.nodes.length<=total)ribbonAddPoint(f,f.anchor);f.nodes.length=total+1;
    f.dropPins=[];var start=0;
    for(var leg=0;leg<counts.length;leg++) {
      for(var j=leg?1:0;j<=counts[leg];j++){var node=f.nodes[start+j];node.p.lerpVectors(points[leg],points[leg+1],j/counts[leg]);node.prev.copy(node.p);node.pin=false;}
      start+=counts[leg];if(leg<route.guides.length){f.dropPins.push({i:start,p:route.guides[leg]});f.nodes[start].pin=true;}
    }
    route.contacts.forEach(function(c,i){c.inner=f.dropPins[2*i].i;c.outer=f.dropPins[2*i+1].i;});
    f.paid=Math.min(RIBBON_PHYSICS.tapeLen,Math.max(f.paid,total*RIBBON_SEGMENT));f.lastLen=Math.max(RIBBON_SEGMENT*.5,f.nodes[total-1].p.distanceTo(f.roll));
    f.asleep=false;f.acc=0;f.calm=0;f.settleAge=0;
  }
  function ribbonConstrainDrop(f) {
    var route=f.dropRoute;if(!route)return;
    for(var pin=0;pin<f.dropPins.length;pin++){var fixed=f.dropPins[pin];f.nodes[fixed.i].p.copy(fixed.p);}
    for(var i=1;i<f.nodes.length-1;i++) {
      var p=f.nodes[i].p;
      for(var k=0;k<route.contacts.length;k++){var c=route.contacts[k],b=c.barrier;if(p.z<b.min.z-.02||p.z>b.max.z+.02)continue;
        if(i<c.inner)p.x=c.sign<0?Math.min(p.x,c.guides[0].x):Math.max(p.x,c.guides[0].x);
        else if(i>c.outer)p.x=c.sign<0?Math.max(p.x,c.guides[1].x):Math.min(p.x,c.guides[1].x);
        else p.y=Math.max(p.y,b.max.y+.02);
      }
      for(var k=0;k<route.separations.length;k++){var c=route.separations[k],b=c.barrier;if(p.z>=b.min.z-.02&&p.z<=b.max.z+.02)p.x=c.sign<0?Math.min(p.x,c.x):Math.max(p.x,c.x);}
    }
    if(Math.abs(f.anchor.x-route.floor.x)>1e-6&&f.nodes.length>2)f.nodes[1].p.y=Math.max(f.nodes[1].p.y,route.slideTop);
    if(route.endSupportTop&&f.nodes.length>2){var before=f.nodes[f.nodes.length-2].p;before.y=Math.max(before.y,route.endSupportTop);}
  }
  function ribbonRopeStep(f, dt) {
    if(f.dropRoute&&!f.dropRoute.barrier&&RIBBON.world.barrierCrosses(f.dropRoute.floor,f.roll))ribbonPrepareDrop(f);
    var nodes = f.nodes, last = nodes.length - 1;
    if (last < 2) return;
    for (var i = 1; i < last; i++) {
      var node=nodes[i];if(node.pin)continue;var before=nodes[i-1].p, after=nodes[i+1].p;
      var tx=after.x-before.x, ty=after.y-before.y, tz=after.z-before.z, length=Math.hypot(tx,ty,tz)||1;
      tx/=length;ty/=length;tz/=length;
      var vx=(node.p.x-node.prev.x)/dt,vy=(node.p.y-node.prev.y)/dt-RIBBON_PHYSICS.g*dt,vz=(node.p.z-node.prev.z)/dt;
      var tangential=vx*tx+vy*ty+vz*tz;
      var nx=vx-tangential*tx,ny=vy-tangential*ty,nz=vz-tangential*tz;
      var normalSpeed=Math.hypot(nx,ny,nz),normalDrag=1/(1+RIBBON_PHYSICS.dragN*normalSpeed*dt);
      var tv=tangential/(1+RIBBON_PHYSICS.dragT*Math.abs(tangential)*dt)*dt;
      var amplitude=RIBBON_PHYSICS.flutter*RIBBON_PHYSICS.g*Math.min(1,normalSpeed*normalSpeed)*dt;
      var phase=i*1.7+(f.seed||0);
      nx=nx*normalDrag+tz*amplitude*Math.sin(phase+f.time*9.1);
      ny=ny*normalDrag+.35*amplitude*Math.sin(phase*.6+f.time*6.3);
      nz=nz*normalDrag-tx*amplitude*Math.sin(phase+f.time*9.1);
      node.prev.copy(node.p);
      node.p.x += nx * dt + tx * tv;
      node.p.y += ny * dt + ty * tv;
      node.p.z += nz * dt + tz * tv;
    }
    for (var pass = 0; pass < 4; pass++) {
      nodes[0].p.copy(f.anchor);
      nodes[last].p.copy(f.roll);ribbonConstrainDrop(f);
      for (var j = 0; j < (f.resolved ? last : last-1); j++) {
        var a = nodes[j].p, b = nodes[j + 1].p, dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        var d = Math.hypot(dx, dy, dz);
        var rest = j===last-1 && f.lastLen ? f.lastLen : RIBBON_SEGMENT;
        if (d <= rest || !d) continue;
        var wa=j===0||nodes[j].pin?0:1,wb=j+1===last||nodes[j+1].pin?0:1,total=wa+wb;if(!total)continue;
        var k=(d-rest)/d/total;a.x+=dx*k*wa;a.y+=dy*k*wa;a.z+=dz*k*wa;b.x-=dx*k*wb;b.y-=dy*k*wb;b.z-=dz*k*wb;
      }
    }
    if (RIBBON.world) for(var n=1;n<last;n++) {
      var v=nodes[n];if(v.pin)continue;
      var contact=RIBBON.world.collide(v.p,null,0.01,f.owner);
      if(contact.hit) v.prev.lerp(v.p,0.7);
    }
    if(RIBBON.world&&RIBBON.world.constrainBodySegment)for(var pass=0;pass<4;pass++)for(var n=0;n<last;n++)RIBBON.world.constrainBodySegment(nodes[n].p,nodes[n+1].p,n>0&&!nodes[n].pin,n+1<last&&!nodes[n+1].pin,.012);
    ribbonConstrainDrop(f);
  }
  var ribbonTangent = new THREE.Vector3(), ribbonView = new THREE.Vector3(), ribbonSide = new THREE.Vector3();
  function ribbonUpdateMesh(f,viewPosition) {
    if(f.rollMesh) {
      f.rollMesh.position.copy(f.roll);
      if(f.visualOffset)f.rollMesh.position.addScaledVector(f.visualOffset,Math.max(0,1-f.time/.09));
      f.rollMesh.rotation.set(Math.PI/2+f.time*8,f.heading||0,(f.alpha||0)*Math.PI/720);
    }
    var nodes = f.nodes, count = nodes.length, attr = f.geo.attributes.position, colors = f.geo.attributes.color, arr = attr.array, col = colors.array;
    for (var i = 0; i < count; i++) {
      var before = nodes[Math.max(0, i - 1)].p, after = nodes[Math.min(count - 1, i + 1)].p, p = nodes[i].p;
      var tangent = ribbonTangent.subVectors(after, before), view = ribbonView.subVectors(viewPosition || camera.position, p), side = ribbonSide.crossVectors(tangent, view);
      if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
      side.normalize().multiplyScalar(.015);
      var k = i * 6, shade = .7+.3*Math.cos(i*RIBBON_SEGMENT/.5*2*Math.PI+(f.seed||0));
      arr[k] = p.x - side.x; arr[k + 1] = p.y - side.y; arr[k + 2] = p.z - side.z;
      arr[k + 3] = p.x + side.x; arr[k + 4] = p.y + side.y; arr[k + 5] = p.z + side.z;
      col[k] = col[k + 3] = f.color.r * shade; col[k + 1] = col[k + 4] = f.color.g * shade; col[k + 2] = col[k + 5] = f.color.b * shade;
    }
    attr.needsUpdate = true;
    colors.needsUpdate = true;
    f.geo.setDrawRange(0, Math.max(0, count - 1) * 6);

  }
  function ribbonDisposeSettled() {
    RIBBON.settled.forEach(function(f){ scene.remove(f.mesh); f.geo.dispose(); f.mesh.material.dispose(); ribbonDisposeSpool(f.rollMesh); });
    RIBBON.settled = [];
  }
  function ribbonDisposeFlight() {
    if (!RIBBON.flight) return;
    ribbonDisposeSpool(RIBBON.flight.rollMesh);
    scene.remove(RIBBON.flight.mesh);
    RIBBON.flight.geo.dispose();
    RIBBON.flight.mesh.material.dispose();
    RIBBON.flight = null;
  }
  function ribbonClearAudience(restore){if(!RIBBON)return;if(RIBBON.crowd)RIBBON.crowd.clear(restore);if(RIBBON.angrySeats)RIBBON.angrySeats.clear();moodGroup.children.slice().forEach(function(sp){if(sp.userData.ribbonReaction){moodGroup.remove(sp);if(sp.userData.seat.mood===sp)sp.userData.seat.mood=null;}});}
  function ribbonNewEgg() {
    RIBBON.egg = { checked: new Set() };
    RIBBON.angrySeats = new Set();
  }
  function ribbonMaybeEgg(target) {
    var egg = RIBBON.egg;
    if (!egg || target.light || target.fan || target.towel || egg.checked.has(RIBBON.attempts)) return;
    egg.checked.add(RIBBON.attempts);
    if (Math.random() >= .5) return;
    var winners = new Set(RIBBON.results.slice((RIBBON.roundIndex || 0) * 10)
      .filter(function(result) { return result.ok; })
      .map(function(result) { return result.seat; }));
    seats.forEach(function(seat) {
      if (seat === target || !seatOcc(seat) || winners.has(seat.i) || RIBBON.crowd.entries.get(seat.i)?.caught) return;
      if (RIBBON.roundIndex !== 2 && seat.pos.distanceTo(target.pos) > 1.05) return;
      RIBBON.angrySeats.add(seat.i);
      if (seat.mood) {
        moodGroup.remove(seat.mood);
        seat.mood = null;
      }
    });
    if (RIBBON.angrySeats.size) {
      RIBBON.crowd.beginAnger(moodMaterial("😡").map);
      ribbonFeedback({ roll: target.pos }, "又是他！", "#ff706d");
      RIBBON.effects[RIBBON.effects.length - 1].popup = true;
    }
  }


  function ribbonInterceptionChance(){
    if(RIBBON.roundIndex<1)return 0;
    var prior=RIBBON.results.slice(0,RIBBON.roundIndex*10).reduce(function(sum,r){return sum+(r.points||0);},0),hits=RIBBON.results.slice(RIBBON.roundIndex*10).filter(function(r){return r.ok;}).length;
    var chance=Math.min(.7,.12+.03*hits+Math.min(.25,prior/6000*.25));return RIBBON.roundIndex===1?chance*.45:chance;
  }
  function ribbonLockInterception(){
    var key=RIBBON.attempts,decisions=RIBBON.interceptionDecisions;
    if(!decisions)return;
    if(!decisions[key]){var chance=ribbonInterceptionChance();decisions[key]={chance:chance,active:chance>0&&Math.random()<chance,seed:Math.random(),receivers:ribbonReceiverSnapshot()};}
    RIBBON.challenge=decisions[key];
  }
  function ribbonInterceptors(shot,target,thrower,challenge){
    challenge=challenge===undefined?RIBBON.challenge:challenge;
    if(!challenge||!challenge.active||!RIBBON.catchBySeat)return [];
    var dx=shot.velocity.x,dz=shot.velocity.z,speed=Math.hypot(dx,dz)||1;dx/=speed;dz/=speed;
    var targetPoint=headWorld(target,new THREE.Vector3()),end=(targetPoint.x-shot.origin.x)*dx+(targetPoint.z-shot.origin.z)*dz,choices=[];
    RIBBON.catchBySeat.forEach(function(q){if(q.seat===target||!ribbonCanReceive(q.seat,challenge.receivers))return;var x=q.x-shot.origin.x,z=q.z-shot.origin.z,along=x*dx+z*dz,lateral=Math.abs(x*dz-z*dx);if(along<.5||along>end-.4||lateral>.6*q.k)return;
      var hand=new THREE.Vector3(.08*q.k,q.localShoulder.y+.48*q.k,q.localShoulder.z-.34*q.k).applyMatrix4(q.seat.m);
      choices.push({seat:q.seat,hand:hand,k:q.k,start:Math.max(0,(along-.9)/speed),along:along});
    });choices.sort(function(a,b){return a.along-b.along||a.seat.i-b.seat.i;});return choices;
  }
  function ribbonCatchInterception(f){
    var best=null,nearest=Infinity;(f.interceptors||[]).forEach(function(q){
      if(!ribbonCanReceive(q.seat,f.receivers)||f.liveReceivers&&!ribbonCanReceive(q.seat))return;
      var center=RIBBON.catchBySeat.get(q.seat.i),distance=Math.hypot(f.roll.x-center.x,f.roll.y-center.y-.25,f.roll.z-center.z);
      if(f.time>=q.start+.18&&f.roll.distanceTo(q.hand)<.17*q.k&&distance<nearest&&f.roll.distanceTo(center.shoulder)<.615*q.k){nearest=distance;best={seat:q.seat,distance:distance,intercepted:true};}
    });return best;
  }
  function ribbonTickAudience(now){
    var crowd=RIBBON.crowd;if(!crowd||document.hidden||RIBBON.pausedAt)return;var dt=Math.max(0,Math.min(.05,(now-(crowd.last||now))/1000));crowd.last=now;
    if(RIBBON.angrySeats)crowd.tickAnger(RIBBON.angrySeats,camera,RIBBON.fxTime||0,headWorld);
    var f=RIBBON.flight;
    if(f&&!f.resolved){
      var q=RIBBON.catchBySeat&&RIBBON.catchBySeat.get(f.targetSeat.i);
      if(q){var target=new THREE.Vector3(q.x,q.y+.25,q.z);target.add(new THREE.Vector3(0,0,-.24*q.k).transformDirection(q.seat.m).multiplyScalar(.24*q.k));if(f.roll.distanceTo(target)<1.3)crowd.anticipate(q.seat,target,Math.min(1,(1.3-f.roll.distanceTo(target))/.8),f);}
      (f.interceptors||[]).forEach(function(q){if(f.time>=q.start)crowd.anticipate(q.seat,q.hand,(f.time-q.start)/.18,f);});
    }
    crowd.entries.forEach(function(e,i){if(e.caught&&e.flight){if(!e.hand||e.hand.distanceToSquared(e.flight.roll)>1e-10)crowd.pose(e,e.flight.roll);(e.flights||[]).forEach(function(other){if(other!==e.flight&&other.roll&&other.roll.distanceToSquared(e.flight.roll)>1e-10){other.roll.copy(e.flight.roll);if(other.nodes&&other.nodes.length){var tail=other.nodes[other.nodes.length-1];tail.p.copy(other.roll);tail.prev.copy(other.roll);}other.asleep=false;other.calm=0;ribbonUpdateMesh(other);}});}else if(!f||f.resolved||e.anticipation!==f){e.returnAge=(e.returnAge||0)+dt;if(e.returnAge>=.3)crowd.release(i);else if(e.hand)crowd.pose(e,e.hand.clone().lerp(e.hands[1],Math.min(1,dt/.1)));}});
  }
  var ribbonCatchLocal=new THREE.Vector3(),ribbonAudienceMatrix=new THREE.Matrix4();
  function ribbonBuildCatchGrid() {
    RIBBON.catchGrid = new Map();RIBBON.catchBySeat=new Map();
    seats.forEach(function(s){
      if(s.i === S.my || !seatOcc(s)) return;
      headWorld(s, ribbonHead);
      var k=seatHeight(s)/170;IM.arm.getMatrixAt(s.i*2+1,ribbonAudienceMatrix);var shoulder=RibbonCrowd.shoulder(THREE,ribbonAudienceMatrix,k),inverse=s.m.clone().invert();
      var q={seat:s,x:ribbonHead.x,y:ribbonHead.y,z:ribbonHead.z,floor:s.pos.y,k:k,shoulder:shoulder,hold:RibbonCrowd.hold(THREE,s,k,shoulder),inverse:inverse,localShoulder:shoulder.clone().applyMatrix4(inverse)};RIBBON.catchBySeat.set(s.i,q);
      var key = Math.floor(q.x / 0.8) + ":" + Math.floor(q.z / 0.8);
      if(!RIBBON.catchGrid.has(key)) RIBBON.catchGrid.set(key, []);
      RIBBON.catchGrid.get(key).push(q);
    });
  }
  function ribbonCatchAt(p, targetSeat,owner,actors,receivers,live) {
    if(owner===undefined)owner=RIBBON.slot;
    targetSeat = targetSeat || RIBBON.target;
    var best = null, bestD = Infinity, bx = Math.floor(p.x/0.8), bz = Math.floor(p.z/0.8);
    if(!RIBBON.catchGrid) return null;
    for(var x=bx-1;x<=bx+1;x++) for(var z=bz-1;z<=bz+1;z++) {
      var bucket = RIBBON.catchGrid.get(x+":"+z) || [];
      for(var i=0;i<bucket.length;i++) {
        var q=bucket[i], dx=p.x-q.x, dz=p.z-q.z;
        if(!ribbonCanReceive(q.seat,receivers)||live&&!ribbonCanReceive(q.seat))continue;
        if(Math.hypot(dx,dz)>RIBBON_PHYSICS.reachR || p.y<q.floor || p.y>q.y+RIBBON_PHYSICS.reachUp) continue;
        ribbonCatchLocal.copy(p).applyMatrix4(q.inverse);
        if(ribbonCatchLocal.z>q.seat.headZ-.12*q.k||p.distanceTo(q.shoulder)>.615*q.k)continue;
        ribbonHead.set(q.x,q.y+.25,q.z);
        if(RIBBON.world.blocked && RIBBON.world.blocked(p,ribbonHead,owner,actors))continue;
        var distance=Math.hypot(dx,p.y-q.y-0.25,dz);
        if(distance<bestD) {bestD=distance;best={seat:q.seat,distance:distance};}
      }
    }
    return best;
  }
  function ribbonFeedback(f,text,color) {
    RIBBON.effects=RIBBON.effects||[];
    RIBBON.effects.push({at:f.roll.clone(),text:text,color:color,born:RIBBON.fxTime||0});
    if(RIBBON.effects.length>3)RIBBON.effects.shift();
  }
  function ribbonDrawFeedback(width,height) {
    var effects=RIBBON.effects||[];camera.updateMatrixWorld(true);
    for(var i=effects.length-1;i>=0;i--) {
      var effect=effects[i],age=(RIBBON.fxTime||0)-effect.born;if(age>=(effect.popup ? .7 : 1)){effects.splice(i,1);continue;}
      ribbonProject.copy(effect.at).project(camera);
      var x=Math.max(50,Math.min(width-50,(ribbonProject.x+1)*width/2)),y=Math.max(height*.32,Math.min(height-70,(1-ribbonProject.y)*height/2));
      if(ribbonProject.z>1){x=width/2;y=height*.4;}
      if (effect.popup) {
        ribbonCtx.save();
        ribbonCtx.globalAlpha = Math.min(1, age * 12) * Math.min(1, (.7 - age) * 5);
        ribbonCtx.font = "bold 32px sans-serif";
        ribbonCtx.textAlign = "center";
        ribbonCtx.strokeStyle = "#21101b";
        ribbonCtx.fillStyle = effect.color;
        ribbonCtx.lineWidth = 6;
        ribbonCtx.strokeText(effect.text, width / 2, height * .28);
        ribbonCtx.fillText(effect.text, width / 2, height * .28);
        ribbonCtx.restore();
        continue;
      }
      ribbonCtx.save();ribbonCtx.globalAlpha=Math.max(0,1-age);ribbonCtx.strokeStyle=effect.color;ribbonCtx.fillStyle=effect.color;ribbonCtx.lineWidth=2;
      ribbonCtx.beginPath();ribbonCtx.arc(x,y,14+age*36,0,Math.PI*2);ribbonCtx.stroke();
      ribbonCtx.font='bold 18px sans-serif';ribbonCtx.textAlign='center';ribbonCtx.shadowColor='#17121b';ribbonCtx.shadowBlur=8;ribbonCtx.fillText(effect.text,x,y-25-age*20);
      ribbonCtx.restore();
    }
  }
  function ribbonReceiveMood(seat, expression) {
    if (RIBBON.angrySeats) RIBBON.angrySeats.delete(seat.i);
    showMood(seat, expression || "😍");
  }
  function ribbonOutcome(caught, now) {
    var f = RIBBON.flight;
    if(!RIBBON.active || !f || f.resolved) return;
    if(caught&&!ribbonCanReceive(caught.seat))caught=null;
    var target = RIBBON.target, ok = !!caught && caught.seat === target;
    var perfect = ok && caught.distance < RIBBON_PHYSICS.perfect && !caught.pickup && !f.hit && !f.snag;
    RIBBON.attempts++;
    RIBBON.used.add(target.i);
    RIBBON.results.push({ok:ok,perfect:perfect,row:target.row,member:G2.member,points:0,seat:target.i});
    if(ok && G2.member!==null)ribbonRecords.hit(G2.team,G2.member,target.row,perfect);
    f.resolved = true;f.actors=null;
    f.lastLen = Math.max(RIBBON_SEGMENT*.5,f.nodes[f.nodes.length-2].p.distanceTo(f.roll));
    if(caught){f.catchAge=0;f.pickup=!!caught.pickup;f.catchFrom=f.roll.clone();f.receiver=RIBBON.crowd.receive(caught.seat,f.roll,f);f.catchTo=f.receiver.hold.clone();f.catchAge=0;f.intercepted=!!caught.intercepted;}
    if(!caught){f.recoveryPending=true;f.recoveryAge=0;f.recoveryAcc=0;}
    f.removeAt = now + (ok ? 900 : 1200);
    if (ok) {
      RIBBON.hits++;
      RIBBON.combo++;
      RIBBON.bestCombo = Math.max(RIBBON.bestCombo, RIBBON.combo);
      if (perfect) RIBBON.perfect++;
      var points = 100 + (perfect ? 100 : 0) + 10 * Math.min(10, RIBBON.combo - 1);
      RIBBON.score += points;RIBBON.results[RIBBON.results.length-1].points=points;
      target.found = true;
      target.pts = points;
      G2.found = RIBBON.hits;
      G2.score = RIBBON.score;
      G2.combo = RIBBON.combo;
      G2.maxCombo = RIBBON.bestCombo;
      ribbonFeedback(f,perfect?"★ 完美接住":"○ 接住了",perfect?"#ffe27a":"#77e8ae");
      if(!f.pickup)ribbonReceiveMood(target, perfect ? "🤩" : "😍");ribbonMaybeEgg(target);
      SFX.found();
      toast((perfect ? "完美接住！★　" : "接到彩帶！　") + seatLabel(target) + "　+" + points);
    } else {
      RIBBON.misses++;
      RIBBON.combo = 0;
      if (caught) {
        ribbonFeedback(f,caught.intercepted?"× 前排伸手攔截":"× 被接走了","#ff8fc0");
        if(!f.pickup)ribbonReceiveMood(caught.seat);
        toast(seatLabel(caught.seat) + " 把彩帶接走了，沒有送到目標粉絲手上");
      } else if(f.blockedByActor){ribbonFeedback(f,"× 被站位成員擋住","#ff8fc0");toast("彩帶被站位成員擋住，請調整方向，避開成員再投擲。");} else {ribbonFeedback(f,"× 沒有接住","#ff8fc0");toast(f.power < RIBBON.window.lo ? "力度偏弱，下次請更快速向上滑動" : f.power > RIBBON.window.hi ? "力度過強，下次請減輕力度" : "方向偏離，下次請向上直滑，修正左右偏移");}
      SFX.miss();
    }
    if(RIBBON.attempts%RIBBON_ROUND_SIZE===0) {
      var roundIndex=RIBBON.roundIndex,rule=RIBBON_ROUNDS[roundIndex];
      var hits=RIBBON.results.slice(roundIndex*10,(roundIndex+1)*10).filter(function(r){return r.ok;}).length,passed=rule.hits===null||hits>=rule.hits;
      RIBBON.nextRound=passed&&roundIndex<2?roundIndex+1:null;
      RIBBON.cleared=passed&&roundIndex===2;
      RIBBON.phase="resultWait";
      RIBBON.finishReason=RIBBON.cleared?"決勝輪完成十投，三輪挑戰結束！":RIBBON.nextRound!==null?rule.name+"命中 "+hits+"/10，合照後可晉級"+RIBBON_ROUNDS[RIBBON.nextRound].name+"。":rule.name+"命中 "+hits+"/10，未達 "+rule.hits+" 次命中。";
    }
    RIBBON.nextAt=now+(ok?900:1200);
    ribbonUpdateHud();
  }
  function ribbonAdvanceRoll(f, dt) {
    f.time += dt;
    var speed = f.velocity.length(), mass = Math.max(0.004, RIBBON_PHYSICS.rollMass * (1 - f.paid / RIBBON_PHYSICS.tapeLen));
    var dampK = 0.5 * RIBBON_PHYSICS.air * RIBBON_PHYSICS.rollCdA / mass * speed + RIBBON_PHYSICS.pullForce / mass / Math.max(speed, 1e-6);
    var damp = 1 / (1 + dampK * dt);
    f.velocity.multiplyScalar(damp);
    f.velocity.y -= RIBBON_PHYSICS.g * dt;
    if (f.tilt && !f.hit) {
      var vh = Math.hypot(f.velocity.x, f.velocity.z) || 1e-6;
      var sx = -f.velocity.z / vh, sz = f.velocity.x / vh;
      var lift = 0.5 * RIBBON_PHYSICS.air * RIBBON_PHYSICS.liftA / mass * speed * speed * f.tilt * dt;
      f.velocity.x += lift * sx;
      f.velocity.z += lift * sz;
    }
    f.roll.addScaledVector(f.velocity, dt);
    f.paid += speed * dt;
    if (f.roll.y > f.apex) f.apex = f.roll.y;
  }
  var ribbonContactPoint=new THREE.Vector3();
  function ribbonStepRoll(f, target) {
    if(!f.receivers)f.receivers=ribbonReceiverSnapshot();
    for(var half=0;half<2;half++) {
      ribbonAdvanceRoll(f, RIBBON_DT / 2);
      var owner=f.owner===undefined?RIBBON.slot:f.owner;
      var beforeContact=ribbonContactPoint.copy(f.roll),preIntercept=ribbonCatchInterception(f),contact = RIBBON.world.collide(f.roll,f.velocity,RIBBON_PHYSICS.rollR,owner,f.actors,f.liveReceivers?undefined:f.bodies);
      if(!contact.obstacle&&contact.audience!==undefined&&['hand','fore','arm'].includes(contact.part)){
        var nearbyGrip=ribbonCatchAt(beforeContact,target,owner,f.actors,f.receivers,f.liveReceivers),grasp=preIntercept&&(!nearbyGrip||preIntercept.seat===nearbyGrip.seat||preIntercept.distance<nearbyGrip.distance)?preIntercept:nearbyGrip;
        if(grasp&&grasp.seat.i===contact.audience){f.roll.copy(beforeContact);return {done:true,caught:grasp};}
      }
      if (contact.hit) f.hit = true;
      if(contact.actor!==undefined)f.blockedByActor=true;
      var caught=null;
      if(!f.blockedByActor&&contact.audience===undefined){var intercepted=ribbonCatchInterception(f),nearby=ribbonCatchAt(f.roll,target,owner,f.actors,f.receivers,f.liveReceivers);caught=intercepted&&(!nearby||intercepted.seat===nearby.seat||intercepted.distance<nearby.distance)?intercepted:nearby;}
      if (caught) return { done:true, caught:caught };
      if (contact.landed && contact.actor===undefined) {
        f.landed=true;
        return {done:true,caught:null};
      }
      if(f.time>=8) return {done:true,caught:null};
    }
    return {done:false,caught:null};
  }
  function ribbonPhysicsStep(f, dt, now) {
    var outcome = ribbonStepRoll(f, RIBBON.target);
    ribbonAddTrail(f, f.roll);
    ribbonRopeStep(f, dt);
    if (outcome.done) ribbonOutcome(outcome.caught, now);
  }

  function ribbonLaunch(power, alpha, now) {
    if(!RIBBON.active||RIBBON.phase!=="play"||RIBBON.flight||!RIBBON.window||!ribbonRequireVisibleTarget())return;
    if(!ribbonCanReceive(RIBBON.target)){ribbonStartPlay(now);return;}
    var shot = ribbonBuildLaunch(power, alpha);
    if (!shot) return;
    var color = RIBBON.color, f = ribbonMakeTrail(color);
    f.receivers=ribbonReceiverSnapshot();f.liveReceivers=true;f.bodies=RIBBON.world.snapshotBodies?RIBBON.world.snapshotBodies():null;f.interceptors=ribbonInterceptors(shot,RIBBON.target,RIBBON.thrower);f.owner = RIBBON.slot;f.actors=RIBBON.world.snapshotActors?RIBBON.world.snapshotActors():null;
    f.targetSeat = RIBBON.target;
    f.anchor = RIBBON.thrower.hold.clone();
    f.roll = shot.origin.clone();
    f.velocity = shot.velocity;
    f.heading=Math.atan2(shot.velocity.x,shot.velocity.z);
    if(RIBBON.heldSpool){f.visualOffset=RIBBON.heldSpool.position.clone().sub(shot.origin);RIBBON.heldSpool.visible=false;}
    f.acc = 0;
    f.time = 0;
    f.resolved = false;
    f.alpha = alpha;
    f.power = power;
    f.tilt = shot.tilt;
    f.paid = 0;
    f.apex = shot.origin.y;
    f.hit = false;
    f.snag = false;
    f.startAt = now;
    ribbonAddPoint(f, f.anchor);
    ribbonAddPoint(f, f.roll, f.velocity);
    RIBBON.flight = f;
    RIBBON.gesture = null;
    ribbonSetPower(power);
    ribbonUpdateHud();
    SFX.go();
  }
  function ribbonBeginSession(member) {
    RIBBON.session = (RIBBON.session || 0) + 1;
    RIBBON.active = false;
    RIBBON.phase = "idle";
    ribbonRestoreCast();
    RIBBON.photoURL = null;RIBBON.photoAttempted=false;
    $("ribbonFinaleNote").hidden = true;
    RIBBON.target = null; RIBBON.window = null; RIBBON.world = null; RIBBON.thrower = null; RIBBON.pausedAt = 0;
    ribbonMark.hidden = true;
    $("ribbonHud").hidden = true;
    $("countdown").hidden = true;
    ribbonCancelGesture();
    ribbonClearAudience();
    ribbonDisposeHeld();
    ribbonDisposeFlight();
    ribbonDisposeSettled();
    $("ribbonSummary").hidden = true;
    $("ribbonPhoto").hidden = true;
    $("ribbonPhoto").removeAttribute("src");
    var team = TEAMS[G2.team];
    RIBBON.roster = Array.from({length:14},function(_,i){return i<team.members.length?(G2.member+i)%team.members.length:null;});
    RIBBON.stations=ribbonMakeStations();RIBBON.order=Array.from({length:14},function(_,i){return i;});
    for(var order=13;order>1;order--){var swap=1+Math.floor(Math.random()*order),value=RIBBON.order[order];RIBBON.order[order]=RIBBON.order[swap];RIBBON.order[swap]=value;}
    RIBBON.targets = G2.fans.slice();
    if (!RIBBON.targets.length) {
      G2.phase = "idle";
      $("startPanel").hidden = false;
      toast("目前沒有可投遞的應援粉絲，請換一位成員再試。");
      return;
    }
    ribbonAddCast();
    RIBBON.crowd=new RibbonCrowd(THREE,IM,seats,seatHeight,{fans:uchiwa,towels:towelG,scene:scene,getWorld:function(){return RIBBON.world;}});
    ribbonBuildCatchGrid();
    RIBBON.world = new RibbonWorld(THREE, scene, IM, seats, {width:ROOM_W, height:ROOM_H, depth:ROOM_D, z:ROOM_Z, platforms:platforms});
    drag = null; ptrs = {}; pinch = null;
    RIBBON.active = true;
    RIBBON.phase = "countdown";
    RIBBON.thrower = null;RIBBON.throwers=null;RIBBON.heldHeadings={};RIBBON.heldThrowers={};
    RIBBON.attempts = RIBBON.hits = RIBBON.perfect = RIBBON.misses = 0;
    RIBBON.combo = RIBBON.bestCombo = RIBBON.score = 0;
    RIBBON.interceptionDecisions={};RIBBON.challenge=null;RIBBON.cleared=false;RIBBON.roundIndex=0;RIBBON.nextRound=null;RIBBON.runRecorded=false;RIBBON.throwColors=[];RIBBON.paletteOffset=Math.floor(Math.random()*RIBBON_PALETTE.length);RIBBON.results = [];RIBBON.effects=[];RIBBON.waveStart=lastT||0;RIBBON.fxTime=0;RIBBON.runTitles=ribbonRecords.snapshot().titles;ribbonNewEgg();
    ribbonPrepareThrower();
    RIBBON.used.clear();
    RIBBON.windowCache = new Map();RIBBON.windowTasks=new Map();RIBBON.reachableRows={};RIBBON.recordsReady=false;
    var prototype=performers[RIBBON.slot],releaseLocal=prototype.g.worldToLocal(RIBBON.thrower.release.clone()),holdLocal=prototype.g.worldToLocal(RIBBON.thrower.hold.clone());
    RIBBON.throwers=performers.map(function(p){p.g.updateMatrixWorld(true);var matrix=p.g.matrixWorld.clone();matrix.makeRotationY(Math.PI);matrix.scale(p.g.scale);matrix.setPosition(p.g.position);return {slot:p.i,position:p.g.position.clone(),baseForAim:true,heading:0,zone:RIBBON.stations[p.i].zone,station:RIBBON.stations[p.i].station,eye:new THREE.Vector3(p.g.position.x,S.stageH+S.perfH/100*.935,p.g.position.z+.1),release:releaseLocal.clone().applyMatrix4(matrix),hold:holdLocal.clone().applyMatrix4(matrix)};});
    RIBBON.target = null;
    RIBBON.window = null;
    ribbonCancelGesture();
    RIBBON.nextAt = 0;
    RIBBON.lastCd = 0;
    RIBBON.pausedAt = 0;
    RIBBON.cdStart = performance.now();
    RIBBON.lastFrame = RIBBON.cdStart;
    RIBBON.color=ribbonThrowColor(member,0);
    RIBBON.heldSpool=ribbonMakeSpool(RIBBON.color);RIBBON.heldSpool.visible=false;scene.add(RIBBON.heldSpool);
    RIBBON.finishReason = "";
    G2.on = false;
    G2.result = false;
    G2.phase = "ribbon";
    S.blackout = false;
    $("gameHud").hidden = true;
    $("ribbonSummary").hidden = true;
    $("ribbonHud").hidden = true;
    ribbonMark.hidden = true;
    $("countdown").hidden = false;
    $("cdNum").textContent = "3";
    $("app").classList.add("playing");
    $("modeBar").hidden = true;
    ribbonSetPower(0);
    ribbonUpdateHud();
    updateHud();
    canvas.focus({ preventScroll: true });
    RIBBON.collectionTask=ribbonExploreRecords(RIBBON.session).catch(function(error){console.warn("彩帶實績探索未完成",error);});
  }
  function ribbonFillPhotoTapes(){
    var owners=new Set(RIBBON.settled.map(function(f){return f.owner;})),taken=new Set();
    RIBBON.settled.forEach(function(f){if(f.receiver)taken.add(f.receiver.seat.i);});
    var missing=RIBBON.stations.map(function(_,i){return i;}).filter(function(i){return !owners.has(i);}),lists=new Map(),assigned=new Map();
    missing.forEach(function(owner){var station=RIBBON.stations[owner],hold=performers[owner].elL.localToWorld(new THREE.Vector3(0,-.245,0));
      var candidates=seats.filter(function(seat){if(!seatOcc(seat)||seat.i===S.my||taken.has(seat.i)||!ribbonCanReceive(seat))return false;var q=RIBBON.catchBySeat.get(seat.i),point=q.hold,angle=wrapAng(Math.atan2(point.x-station.position.x,point.z-station.position.z)-station.heading);if(Math.abs(angle)>Math.PI/4)return false;return !RIBBON.world.blocked(hold,point,owner);});
      for(var i=candidates.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),q=candidates[i];candidates[i]=candidates[j];candidates[j]=q;}lists.set(owner,candidates);
    });
    function match(owner,seen){var candidates=lists.get(owner);for(var i=0;i<candidates.length;i++){var seat=candidates[i];if(seen.has(seat.i))continue;seen.add(seat.i);var old=assigned.get(seat.i);if(old===undefined||match(old,seen)){assigned.set(seat.i,owner);return true;}}return false;}
    missing.forEach(function(owner){match(owner,new Set());});
    assigned.forEach(function(owner,id){var seat=seats[id],p=performers[owner];p.g.updateMatrixWorld(true);var f=ribbonMakeTrail(RIBBON_PALETTE[(RIBBON.paletteOffset+owner*5+(RIBBON.roundIndex||0)*3)%12]);
      Object.assign(f,{owner:owner,targetSeat:seat,decorative:true,anchor:p.elL.localToWorld(new THREE.Vector3(0,-.245,0)),velocity:new THREE.Vector3(),resolved:true,time:0,paid:0,acc:0,alpha:0,heading:0,hit:false,snag:false});
      f.receiver=RIBBON.crowd.receive(seat,RIBBON.crowd.ensure(seat).hold,f);ribbonReceiveMood(seat);f.roll=f.receiver.hold.clone();f.catchFrom=f.roll.clone();f.catchTo=f.roll.clone();f.catchAge=.75;
      var count=Math.min(RIBBON_MAX-1,Math.max(8,Math.ceil((f.anchor.distanceTo(f.roll)+1.5)/RIBBON_SEGMENT))),point=new THREE.Vector3();
      for(var n=0;n<=count;n++){var t=n/count;point.lerpVectors(f.anchor,f.roll,t);point.y+=.75*Math.sin(Math.PI*t);ribbonAddPoint(f,point);}f.paid=Math.min(30,count*RIBBON_SEGMENT);f.lastLen=RIBBON_SEGMENT;f.mesh.material.opacity=0;f.rollMesh.traverse(function(o){if(o.material){o.material.transparent=true;o.material.opacity=0;}});RIBBON.settled.push(f);
    });
  }
  function finishRibbonGame(reason) {
    if (!RIBBON.active) return;
    if(reason&&reason!==RIBBON.finishReason)RIBBON.nextRound=null;
    RIBBON.resultFrom=performers.map(function(p){return {position:p.g.position.clone(),yaw:p.g.rotation.y,arms:[p.armL.quaternion.clone(),p.armR.quaternion.clone()],elbows:[p.elL.quaternion.clone(),p.elR.quaternion.clone()]};});
    RIBBON.resultStartPosition=camera.position.clone();RIBBON.resultStartQuaternion=camera.quaternion.clone();RIBBON.resultStartFov=camera.fov;RIBBON.resultView=null;
    RIBBON.active = false;
    if(RIBBON.world&&RIBBON.world.setActors)RIBBON.world.setActors([]);
    ribbonDisposeHeld();
    RIBBON.session++;
    RIBBON.phase = "result";
    RIBBON.resultAge = 0;
    RIBBON.finaleDone = false;
    ribbonRecords.finish(RIBBON.results,G2.team,RIBBON.roster.filter(function(m){return m!==null;}),!RIBBON.runRecorded);
    if(RIBBON.results.length)RIBBON.runRecorded=true;
    RIBBON.photoURL = null; RIBBON.photoAttempted = false;
    RIBBON.lastFrame = performance.now();
    S.yaw = 0; S.pitch = 0;
    $("ribbonPhoto").hidden = true;
    $("ribbonExportStatus").textContent = "彩帶正在集合，稍後可儲存合照。";
    $("ribbonExport").disabled = true;
    ribbonCancelGesture();
    RIBBON.window = null;
    RIBBON.target = null;
    G2.on = false;
    G2.phase = "idle";
    S.blackout = false;
    if(RIBBON.flight) { RIBBON.settled.push(RIBBON.flight); RIBBON.flight = null; }
    performers.forEach(function(p){p.g.updateMatrixWorld(true);});ribbonFillPhotoTapes();
    RIBBON.settled.forEach(function(f){f.finaleFrom=f.anchor.clone();f.actors=null;if(f.owner>=6)ribbonPrepareDrop(f);});
    $("countdown").hidden = true;
    $("ribbonHud").hidden = true;
    ribbonMark.hidden = true;
    $("app").classList.remove("playing");
    $("ribbonResultTitle").textContent=RIBBON.nextRound!==null?RIBBON_ROUNDS[RIBBON.roundIndex].name+"合照":RIBBON.cleared?"三輪挑戰完成":"彩帶挑戰結束";
    $("ribbonNext").hidden=RIBBON.nextRound===null;$("ribbonNext").disabled=true;
    if(RIBBON.nextRound!==null)$("ribbonNext").textContent="晉級"+RIBBON_ROUNDS[RIBBON.nextRound].name;
    $("ribbonAgain").className=RIBBON.nextRound===null?"primary":"ghost";
    $("ribbonResultMessage").textContent = (reason || RIBBON.finishReason || "挑戰已結束。")+" 以下為截至目前的累計成果。";
    var ratio=RIBBON.attempts?RIBBON.hits/RIBBON.attempts:0;
    var value=.75*ratio+.25*Math.min(1,RIBBON.bestCombo/Math.max(1,RIBBON.attempts));
    var rank=value>=.72?"ㄅ":value>=.52?"ㄆ":value>=.3?"ㄇ":"ㄈ";
    $("ribbonRank").textContent=rank;$("ribbonBadge").dataset.rank=rank;
    $("ribbonResultScore").textContent=RIBBON.score.toLocaleString("zh-TW");
    var best=ribbonRecords.snapshot();$("ribbonRecordResult").textContent="彩帶實績 · 最高命中 "+best.bestHit+" 次／完美 "+best.bestPerfect+" 次";
    $("ribbonResultStats").innerHTML=[["投出彩帶",RIBBON.attempts+" 次"],["命中次數",RIBBON.hits+" 次"],["完美接取",RIBBON.perfect+" ★"],["最高 Combo",RIBBON.bestCombo],["失手",RIBBON.misses+" 次"],["命中率",Math.round(ratio*100)+"%"]].map(function(item){return "<div><span>"+item[0]+"</span><b>"+item[1]+"</b></div>";}).join("");
    var lastBase=Math.floor(Math.max(0,RIBBON.results.length-1)/RIBBON_ROUND_SIZE)*RIBBON_ROUND_SIZE;
    $("ribbonResultDots").innerHTML=RIBBON.results.slice(lastBase).map(function(r){return '<i class="'+(r.ok?'hit':'miss')+'" title="'+(r.row||'')+'排 '+(r.perfect?'完美':r.ok?'命中':'失手')+'"></i>';}).join('');
    $("ribbonRoundResults").innerHTML=RIBBON_ROUNDS.filter(function(_,i){return i*10<RIBBON.results.length;}).map(function(rule,i){var results=RIBBON.results.slice(i*10,(i+1)*10),hits=results.filter(function(r){return r.ok;}).length;return '<p>'+rule.name+'：命中 '+hits+'/'+results.length+(rule.hits===null?'（不設門檻） · ':'（十投門檻 '+rule.hits+' 中） · ')+(results.length<10?'未完成':rule.hits===null?'完成':hits>=rule.hits?'過關':'未過關')+'</p>';}).join('');
    var newTitles=ribbonRecords.snapshot().titles.filter(function(id){return !(RIBBON.runTitles||[]).includes(id);});
    $("ribbonRunAwards").innerHTML=ribbonRecords.titles.filter(function(title){return newTitles.includes(title[0]);}).map(function(title){return '<span>新實績 · '+esc(title[1])+'</span>';}).join('');
    RIBBON.presentationReady=RIBBON.settled.length===0;
    $("ribbonSummary").hidden=!RIBBON.presentationReady;
    $("ribbonFinaleNote").hidden=RIBBON.presentationReady;
    if (RIBBON.presentationReady) $("ribbonAgain").focus({ preventScroll: true });
    syncModeBar();updateHud();
  }
  function closeRibbonSummary() {
    RIBBON.active=false;RIBBON.session++;RIBBON.nextRound=null;RIBBON.presentationReady=false;
    G2.phase="idle";$("app").classList.remove("playing");$("countdown").hidden=true;$("ribbonHud").hidden=true;ribbonMark.hidden=true;
    ribbonClearAudience();
    if($("ribbonRecordDialog").open)$("ribbonRecordDialog").close();
    ribbonDisposeHeld();
    ribbonDisposeSettled();
    $("ribbonSummary").hidden = true;
    $("ribbonFinaleNote").hidden = true;
    RIBBON.photoURL = null;RIBBON.effects=[];
    RIBBON.phase = "idle";
    ribbonRestoreCast();
    RIBBON.thrower = null;
    RIBBON.pausedAt = 0;
    RIBBON.world = null;
    RIBBON.windowCache = null;
    RIBBON.window = null;
    $("ribbonPhoto").removeAttribute("src");
    camera.aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight);resetLook(); updateCamera();
    RIBBON.target = null;
    RIBBON.used.clear();
    ribbonDisposeFlight();
    if (typeof MODE === "undefined" || MODE === "game") {
      $("startPanel").hidden = false;
      $(selectedGame === "ribbon" ? "ribbonStart" : "gStart").focus({ preventScroll: true });
    }
    updateHud();
  }
  function ribbonContinueRound() {
    if(RIBBON.phase!=="result"||!RIBBON.presentationReady||RIBBON.nextRound===null||$("ribbonNext").disabled)return false;
    $("ribbonNext").disabled=true;
    var next=RIBBON.nextRound;RIBBON.nextRound=null;RIBBON.session++;RIBBON.active=true;RIBBON.phase="countdown";RIBBON.roundIndex=next;
    ribbonCancelGesture();ribbonClearAudience();ribbonDisposeHeld();ribbonDisposeFlight();ribbonDisposeSettled();
    RIBBON.photoURL=null;RIBBON.photoAttempted=false;RIBBON.presentationReady=false;RIBBON.resultFrom=null;RIBBON.resultView=null;
    RIBBON.target=null;RIBBON.window=null;RIBBON.thrower=null;RIBBON.heldHeadings={};RIBBON.heldThrowers={};RIBBON.used.clear();
    RIBBON.effects=[];RIBBON.waveStart=lastT||0;RIBBON.fxTime=0;RIBBON.finishReason="";RIBBON.cleared=false;ribbonNewEgg();
    RIBBON.windowCache=new Map();RIBBON.windowTasks=new Map();RIBBON.reachableRows={};RIBBON.recordsReady=false;
    $("ribbonSummary").hidden=true;$("ribbonPhoto").hidden=true;$("ribbonPhoto").removeAttribute("src");$("ribbonFinaleNote").hidden=true;$("ribbonNext").hidden=true;
    drag=null;ptrs={};pinch=null;S.yaw=0;S.pitch=0;S.fov=IDOL_FOV;
    canvas.focus({ preventScroll: true });
    ribbonPrepareThrower();RIBBON.heldSpool=ribbonMakeSpool(RIBBON.color);RIBBON.heldSpool.visible=false;scene.add(RIBBON.heldSpool);
    RIBBON.nextAt=0;RIBBON.lastCd=0;RIBBON.pausedAt=0;RIBBON.cdStart=performance.now();RIBBON.lastFrame=RIBBON.cdStart;
    G2.on=false;G2.result=false;G2.phase="ribbon";S.blackout=false;
    $("app").classList.add("playing");$("modeBar").hidden=true;$("countdown").hidden=false;$("cdNum").textContent="3";$("ribbonHud").hidden=true;ribbonMark.hidden=true;
    ribbonSetPower(0);ribbonUpdateHud();updateCamera();updateHud();
    canvas.focus({ preventScroll: true });
    RIBBON.collectionTask=ribbonExploreRecords(RIBBON.session).catch(function(error){console.warn("彩帶實績探索未完成",error);});
    return true;
  }
  async function ribbonStartPlay(now) {
    if (!RIBBON.active || !["countdown","play"].includes(RIBBON.phase)) return;
    var session = RIBBON.session;
    RIBBON.phase = "selecting";
    if(RIBBON.heldSpool)RIBBON.heldSpool.visible=false;
    ribbonPrepareThrower();
    RIBBON.nextAt = Infinity;
    RIBBON.target = null;
    RIBBON.window = null;
    ribbonCancelGesture();
    ribbonMark.hidden = true;
    gToast.hidden = true;
    clearTimeout(toast.t);
    $("countdown").hidden = true;
    $("ribbonHud").hidden = false;
    $("ribbonHud").setAttribute("aria-busy","true");
    ribbonSetPower(0);
    ribbonUpdateHud();
    try {
      var selection = await ribbonPickTarget(session);
      if (!RIBBON.active || session !== RIBBON.session) return;
      if (!selection) { finishRibbonGame("目前沒有可達的目標粉絲，請換一位成員或重新挑戰。"); return; }
      // Commit only after the entire search succeeds in this session.
      RIBBON.target = selection.target;
      RIBBON.thrower=ribbonAimThrower(selection.thrower||RIBBON.thrower,selection.target);
      RIBBON.heldHeadings[RIBBON.slot]=RIBBON.thrower.heading;
      RIBBON.heldThrowers[RIBBON.slot]=RIBBON.thrower;
      placePerformers(0);performers[RIBBON.slot].g.updateMatrixWorld(true);RIBBON.world.setActors(performers);
      // Existing ribbons remain in this member's holding hand when they turn again.
      RIBBON.settled.forEach(function(f){if(f.owner===RIBBON.slot)f.anchor.copy(RIBBON.thrower.hold);});
      RIBBON.window = selection.window;
      RIBBON.phase = "play";
      $("ribbonHud").setAttribute("aria-busy","false");
      ribbonFaceTarget();
      if(RIBBON.heldSpool){RIBBON.heldSpool.material.color.set(RIBBON.color);RIBBON.heldSpool.material.emissive.set(RIBBON.color);RIBBON.heldAge=0;ribbonTickHeld(0);}
      ribbonSetPower(0);
      ribbonUpdateHud();
      ribbonUpdateMarker();
      toast("瞄準金色標記，快速向上滑動投出彩帶。");
      SFX.go();
    } catch (error) {
      if (!RIBBON.active || session !== RIBBON.session) return;
      console.error("彩帶目標準備失敗", error);
      finishRibbonGame("準備目標時發生錯誤，請重新挑戰。");
    }
  }

  function ribbonDrawPreview(now) {
    var w = $("view").clientWidth, h = $("view").clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var resized = ribbonPreview.width !== Math.round(w * dpr) || ribbonPreview.height !== Math.round(h * dpr);
    if (resized) {
      ribbonPreview.width = Math.round(w * dpr);
      ribbonPreview.height = Math.round(h * dpr);
    }
    var g = RIBBON.gesture;
    var drawing = RIBBON.active && RIBBON.phase === "play" && g && RIBBON.target;
    var feedback=RIBBON.effects&&RIBBON.effects.length;
    if (!drawing && !feedback && !RIBBON.previewDirty && !resized) return;
    ribbonCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ribbonCtx.clearRect(0, 0, w, h);
    RIBBON.previewDirty = !!(drawing||feedback);
    if(feedback)ribbonDrawFeedback(w,h);
    if (!drawing) return;
    var m = ribbonMetrics(g);
    if (m.travel < 0.025) return;
    var shot = ribbonBuildLaunch(m.power, m.alpha);
    if (shot) {
      camera.updateMatrixWorld(true);
      ribbonCtx.save();
      ribbonCtx.beginPath();
      var open = false;
      var predicted = {receivers:ribbonReceiverSnapshot(),bodies:RIBBON.world.snapshotBodies?RIBBON.world.snapshotBodies():null,interceptors:ribbonInterceptors(shot,RIBBON.target,RIBBON.thrower),owner:RIBBON.slot,actors:RIBBON.world.snapshotActors?RIBBON.world.snapshotActors():null, roll: shot.origin.clone(), velocity: shot.velocity.clone(), tilt: shot.tilt, paid: 0, apex: shot.origin.y, hit: false, time: 0 };
      for (var step = 0; step <= 960; step++) {
        var result = step ? ribbonStepRoll(predicted, RIBBON.target) : {done:false};
        var stopped = result.done;
        if(step % 6 && !stopped) continue;
        var pt = predicted.roll.clone().project(camera);
        if (pt.z < 1 && Math.abs(pt.x) < 1.3 && Math.abs(pt.y) < 1.3) {
          var px = (pt.x + 1) * 0.5 * w, py = (1 - pt.y) * 0.5 * h;
          if (!open) { ribbonCtx.moveTo(px, py); open = true; } else ribbonCtx.lineTo(px, py);
        } else if (open) open = false;
        if(stopped) break;
      }
      ribbonCtx.setLineDash([6, 6]);
      ribbonCtx.lineWidth = 2;
      ribbonCtx.strokeStyle = RIBBON.color;
      ribbonCtx.shadowColor = RIBBON.color;
      ribbonCtx.shadowBlur = 9;
      ribbonCtx.stroke();
      ribbonCtx.restore();
    }
    var pts = g.points;
    if (pts.length > 1) {
      ribbonCtx.beginPath();
      ribbonCtx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ribbonCtx.lineTo(pts[i].x, pts[i].y);
      ribbonCtx.lineWidth = 3;
      ribbonCtx.lineCap = "round";
      ribbonCtx.strokeStyle = "rgba(255,255,255,.72)";
      ribbonCtx.stroke();
    }
  }
  // Visual recovery starts only after the scored outcome is immutable.
  function ribbonRecoveryCandidate(f) {
    var best=null,nearest=Infinity,pose=null;
    RIBBON.catchBySeat.forEach(function(q){
      var held=RIBBON.crowd.entries.get(q.seat.i);if(!ribbonCanReceive(q.seat)||!ribbonPickupRowAllowed(q.seat,f.roll))return;
      var distance=Math.hypot(f.roll.x-q.x,f.roll.y-q.floor,f.roll.z-q.z);if(distance>=nearest)return;
      var base=held?held.baseShoulders[1]:q.shoulder,choice=null,pivot=new THREE.Vector3(0,.45+.1*q.k,.05).applyMatrix4(q.seat.m);
      if(f.roll.distanceTo(pivot)>base.distanceTo(pivot)+.61*q.k)return;
      for(var bend of [Math.PI/2,Math.PI/3,Math.PI/6,0]){for(var degrees of [0,-10,10,-20,20,-30,30]){
        var yaw=degrees*Math.PI/180,transform=RibbonCrowd.pickupTransform(THREE,q.seat,q.k,1,yaw,bend),shoulder=base.clone().applyMatrix4(transform);
        if(shoulder.distanceTo(f.roll)>.61*q.k||RIBBON.world.pickupBlocked(f.roll,shoulder,q.seat.i,f.owner))continue;
        choice={yaw:yaw,bend:bend};break;
      }if(choice)break;}
      if(choice){nearest=distance;best=q.seat;pose=choice;}
    });
    if(pose){f.pickupYaw=pose.yaw;f.pickupBend=pose.bend;}
    return best;
  }
  function ribbonTickRecovery(f,dt) {
    if(!f.recoveryPending){
      if(!f.recoveryUnavailable||!f.landed||RIBBON.photoAttempted)return;
      f.retryAge=(f.retryAge||0)+dt;if(f.retryAge<.5)return;f.retryAge=0;
      var key=RIBBON.world.actorRevision()+':'+ribbonReceiverSnapshot().join(',');if(f.retryKey===key)return;f.retryKey=key;
      var retry=ribbonRecoveryCandidate(f);if(!retry)return;
      f.recoveryUnavailable=false;f.recoveryPending=true;
    }
    f.recoveryAge=(f.recoveryAge||0)+dt;f.recoveryAcc=(f.recoveryAcc||0)+dt;
    while(!f.landed&&f.recoveryAcc>=RIBBON_DT){
      f.recoveryAcc-=RIBBON_DT;ribbonAdvanceRoll(f,RIBBON_DT);
      var contact=RIBBON.world.collide(f.roll,f.velocity,RIBBON_PHYSICS.rollR,f.owner);
      if(contact.landed)f.landed=true;
    }
    if(f.nodes&&f.nodes.length>=2){ribbonAddTrail(f,f.roll);f.lastLen=Math.max(RIBBON_SEGMENT*.5,f.nodes[f.nodes.length-2].p.distanceTo(f.roll));}
    if(!f.landed&&f.recoveryAge<8)return;
    f.recoveryPending=false;f.asleep=false;f.calm=0;
    if(!f.landed){f.recoveryUnavailable=true;return;}
    var seat=ribbonRecoveryCandidate(f);
    if(!seat){f.recoveryUnavailable=true;f.retryKey=RIBBON.world.actorRevision()+':'+ribbonReceiverSnapshot().join(',');return;}
    f.velocity.set(0,0,0);f.postScorePickup=true;f.recoveredBy=seat.i;f.pickup=true;f.catchAge=0;f.catchFrom=f.roll.clone();
    f.receiver=RIBBON.crowd.receive(seat,f.roll,f);f.catchTo=f.receiver.hold.clone();
    ribbonFeedback(f,"失手已結算 · 觀眾拾起彩帶","#ffce82");
  }
  function ribbonCatchReady(f){return !f||f.resolved!==false&&!f.recoveryPending&&(!f.catchTo||f.catchAge>=ribbonCatchDuration(f));}
  function ribbonCatchDuration(f){return f.receiver?(f.pickup?.95:.75):.35;}
  function ribbonTickCatch(f,dt) {
    ribbonTickRecovery(f,dt);
    var duration=ribbonCatchDuration(f);if(!f.catchTo||f.catchAge>=duration)return;
    var previousCatchAge = f.catchAge;
    f.catchAge=Math.min(duration,f.catchAge+dt);
    if (f.receiver && f.pickup && previousCatchAge < .2 && f.catchAge >= .2) ribbonReceiveMood(f.receiver.seat);
    var u=f.pickup?Math.max(0,(f.catchAge-.2)/.75):f.catchAge/duration,t=u*u*(3-2*u);f.roll.lerpVectors(f.catchFrom,f.catchTo,t);
    if(f.receiver){f.roll.y+=.05*Math.sin(u*Math.PI);RIBBON.crowd.pose(f.receiver,f.roll);if(f.pickup&&f.catchAge>=.2){var safe=f.receiver.hand.clone();for(var pass=0;pass<4;pass++){var contact=RIBBON.world.collide(safe,null,.035,f.owner,undefined,undefined,f.receiver.seat.i);RIBBON.crowd.pose(f.receiver,safe);safe.copy(f.receiver.hand);if(!contact.hit)break;}f.roll.copy(safe);}}
    if(f.postScorePickup&&f.nodes&&f.nodes.length>=2){ribbonAddTrail(f,f.roll);f.lastLen=Math.max(RIBBON_SEGMENT*.5,f.nodes[f.nodes.length-2].p.distanceTo(f.roll));}
  }
  function ribbonTickSettled(dt) {
    RIBBON.settled.forEach(function(f){
      ribbonTickCatch(f,dt);
      var bodyRevision=RIBBON.world&&RIBBON.world.bodyRevision?RIBBON.world.bodyRevision():0;
      var bodiesMoved=f.bodyRevision!==bodyRevision&&(!f.asleep||!RIBBON.world.touchesChanged||RIBBON.world.touchesChanged(f.nodes,f.bodyRevision));f.bodyRevision=bodyRevision;
      var moved = !f.sleepAnchor || f.sleepAnchor.distanceToSquared(f.anchor) > 1e-8 || f.sleepRoll.distanceToSquared(f.roll) > 1e-8;
      if (moved || bodiesMoved) { f.asleep = false; f.calm = 0; f.settleAge = 0; }
      if (!f.sleepAnchor) { f.sleepAnchor = f.anchor.clone(); f.sleepRoll = f.roll.clone(); }
      f.sleepAnchor.copy(f.anchor); f.sleepRoll.copy(f.roll);
      if (!f.asleep) {
        f.acc += dt;
        var steps = 0, motion = 0;
        while(f.acc >= RIBBON_DT && steps++ < 8) {
          f.acc -= RIBBON_DT;
          if (!f.resolved) {
            var outcome = ribbonStepRoll(f, f.targetSeat);
            ribbonAddTrail(f,f.roll);
            if (outcome.done) {
              f.resolved=true;
              if(!outcome.caught){f.recoveryPending=true;f.recoveryAge=0;f.recoveryAcc=0;}
              else if(ribbonCanReceive(outcome.caught.seat)){f.pickup=!!outcome.caught.pickup;f.catchAge=0;f.catchFrom=f.roll.clone();f.receiver=RIBBON.crowd.receive(outcome.caught.seat,f.roll,f);f.catchTo=f.receiver.hold.clone();if(!f.pickup)ribbonReceiveMood(outcome.caught.seat);}
              f.lastLen=Math.max(RIBBON_SEGMENT*.5,f.nodes[f.nodes.length-2].p.distanceTo(f.roll));
            }
          } else f.time += RIBBON_DT;
          ribbonRopeStep(f, RIBBON_DT);
          for (var i = 1; i < f.nodes.length - 1; i++) motion = Math.max(motion, f.nodes[i].p.distanceToSquared(f.nodes[i].prev));
        }
        if(steps >= 8) f.acc = 0;
        f.settleAge = (f.settleAge || 0) + dt;
        f.calm = motion < 0.000004 ? (f.calm || 0) + dt : 0;
        // As in the reference's nine-second settling cap, retain the full ribbon.
        if (f.resolved && (f.calm > 0.5 || f.settleAge > 9)) { f.asleep = true; f.acc = 0; }
      }
      var cameraMoved = !f.meshCamera || !f.meshCamera.equals(camera.position);
      if (!f.asleep || moved || cameraMoved || !f.meshCamera) ribbonUpdateMesh(f);
      if (!f.meshCamera) f.meshCamera = camera.position.clone();
      else f.meshCamera.copy(camera.position);
    });
  }
  var ribbonFinalHands = [new THREE.Vector3(), new THREE.Vector3()];
  function ribbonTick(now) {
    if (document.hidden || RIBBON.pausedAt) return;
    if (!RIBBON.active) {
      var idleDt = Math.max(0,Math.min(.05,(now-RIBBON.lastFrame)/1000));
      RIBBON.lastFrame = now;
      if(RIBBON.phase === "result") {
        RIBBON.resultAge += idleDt;RIBBON.settled.forEach(function(f){if(f.decorative){var opacity=.94*Math.min(1,RIBBON.resultAge/.45);f.mesh.material.opacity=opacity;f.rollMesh.traverse(function(o){if(o.material)o.material.opacity=opacity;});}});RIBBON.fxTime=(RIBBON.fxTime||0)+idleDt;updateCamera();
        if (!RIBBON.finaleDone) {
          placePerformers(0);
          var blend=Math.min(1,RIBBON.resultAge/1.1); blend=blend*blend*(3-2*blend);
          for(var hand=0;hand<2;hand++) {
            var performer=performers[hand?3:2];performer.g.updateMatrixWorld(true);
            ribbonFinalHands[hand].set(0,-.245,0);
            (hand?performer.elR:performer.elL).localToWorld(ribbonFinalHands[hand]);
          }
          RIBBON.settled.forEach(function(f){
            if (!f.finaleFrom) f.finaleFrom=f.anchor.clone();
            if(f.owner<6)f.anchor.lerpVectors(f.finaleFrom,ribbonFinalHands[f.owner<3?0:1],blend);
            else {var route=f.dropRoute,slide=route&&Math.abs(route.floor.x-f.finaleFrom.x)>1e-6?.16:0,t=Math.max(0,RIBBON.resultAge-slide);f.anchor.copy(f.finaleFrom);if(route)f.anchor.x=THREE.MathUtils.lerp(f.finaleFrom.x,route.floor.x,Math.min(1,RIBBON.resultAge/.16));f.anchor.y=Math.max(S.stageH+.012,f.finaleFrom.y-4.9*t*t);}
          });
          if (RIBBON.resultAge>=1.1) RIBBON.finaleDone=true;
        }
        ribbonTickSettled(idleDt);
        if(RIBBON.resultAge>=2.8 && RIBBON.settled.every(ribbonCatchReady) && !RIBBON.photoAttempted) {
          RIBBON.photoAttempted=true;RIBBON.presentationReady=true;
          $("ribbonSummary").hidden=false;$("ribbonFinaleNote").hidden=true;
          $("ribbonExport").disabled=false;
          ribbonCapturePhoto();$("ribbonNext").disabled=false;
          $(RIBBON.nextRound !== null ? "ribbonNext" : "ribbonAgain").focus({ preventScroll: true });
        }
      }
      ribbonDrawPreview(now); return;
    }
    if (RIBBON.pausedAt) return;
    var dt = Math.max(0, Math.min(0.05, (now - RIBBON.lastFrame) / 1000));
    RIBBON.lastFrame = now;RIBBON.fxTime=(RIBBON.fxTime||0)+dt;
    ribbonTickSettled(dt);
    if (RIBBON.flight && RIBBON.flight.resolved) {
      ribbonTickCatch(RIBBON.flight,dt);
      RIBBON.flight.acc += dt;
      while(RIBBON.flight.acc >= RIBBON_DT) {RIBBON.flight.acc -= RIBBON_DT; RIBBON.flight.time += RIBBON_DT; ribbonRopeStep(RIBBON.flight,RIBBON_DT);}
      ribbonUpdateMesh(RIBBON.flight);
    }
    if (RIBBON.phase === "countdown") {
      var elapsed = now - RIBBON.cdStart, count = 3 - Math.floor(elapsed / 1000);
      if (elapsed < 3000 && count !== RIBBON.lastCd) {
        RIBBON.lastCd = count;
        $("cdNum").textContent = String(count);
        $("cdNum").classList.remove("pop");
        void $("cdNum").offsetWidth;
        $("cdNum").classList.add("pop");
        SFX.count();
      }
      if (elapsed >= 3000) ribbonStartPlay(now);
      ribbonDrawPreview(now);
      return;
    }
    if (RIBBON.phase === "resultWait") {
      if (now >= RIBBON.nextAt && ribbonCatchReady(RIBBON.flight)) finishRibbonGame(RIBBON.finishReason);
      ribbonDrawPreview(now);
      return;
    }
    if (RIBBON.flight && !RIBBON.flight.resolved) {
      var f = RIBBON.flight;
      f.acc += dt;
      var steps = 0;
      while (f.acc >= RIBBON_DT && steps++ < 8 && !f.resolved) {
        f.acc -= RIBBON_DT;
        ribbonPhysicsStep(f, RIBBON_DT, now);
      }
      if (steps >= 8) f.acc = 0;
      if(Math.abs(f.alpha)>RIBBON_PHYSICS.wildFrom && !f.resolved) {
        eyePos(eye);
        var yaw=Math.atan2(eye.x-f.roll.x,eye.z-f.roll.z), pitch=Math.atan2(f.roll.y-eye.y,Math.hypot(f.roll.x-eye.x,f.roll.z-eye.z));
        var follow=1-Math.exp(-6*dt);
        S.yaw+=wrapAng(yaw-S.yaw)*follow;S.pitch+=(Math.max(-.6,Math.min(.5,pitch))-S.pitch)*follow;
        updateCamera();camera.updateMatrixWorld(true);
      }
      ribbonUpdateMesh(f);
    } else if (RIBBON.flight && RIBBON.flight.resolved && now >= RIBBON.flight.removeAt && ribbonCatchReady(RIBBON.flight)) {
      RIBBON.settled.push(RIBBON.flight);
      RIBBON.flight = null;
    }
    if (RIBBON.phase === "play" && !RIBBON.flight && !RIBBON.gesture && Number.isFinite(RIBBON.nextAt) && now >= RIBBON.nextAt) {
      ribbonStartPlay(now);
    }
    ribbonTickHeld(dt);
    ribbonUpdateMarker();
    ribbonDrawPreview(now);
  }
