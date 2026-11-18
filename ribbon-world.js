/* TPE scene adapter. Collision bounds come from the rendered TPE meshes;
 * no coordinates or invisible obstacles from the reference theatre are used. */
(function(root) {
  'use strict';
  root.RibbonWorld = function(THREE, scene, instances, seats, room) {
    var boxes = [], grid = new Map(), matrix = new THREE.Matrix4(),actorBoxes=[],actorGrid=new Map(),actorCache=new Map(),actorRevision=0,barriers=[];
    function add(box) {
      if (box.isEmpty() || box.min.distanceToSquared(box.max)<1e-12) return;
      boxes.push(box);index(box,grid);
    }
    function index(box,targetGrid) {
      for (var x=Math.floor(box.min.x-.04);x<=Math.floor(box.max.x+.04);x++)
        for(var z=Math.floor(box.min.z-.04);z<=Math.floor(box.max.z+.04);z++) {
          var key=x+':'+z;
          if(!targetGrid.has(key))targetGrid.set(key,[]);
          targetGrid.get(key).push(box);
        }
    }
    function addMeshBounds(geometry, transform, blocksTarget,actor,skipAdd) {
      if(!geometry.boundingBox)geometry.computeBoundingBox();
      var bounds=geometry.boundingBox.clone().applyMatrix4(transform);
      bounds.blocksTarget=!!blocksTarget;bounds.geometry=geometry;
      bounds.localBounds=geometry.boundingBox.clone();
      bounds.transform=transform.clone();
      bounds.inverse=transform.clone().invert();
      bounds.normalMatrix=new THREE.Matrix3().getNormalMatrix(transform);
      var e=transform.elements;
      bounds.scale=[Math.hypot(e[0],e[1],e[2]),Math.hypot(e[4],e[5],e[6]),Math.hypot(e[8],e[9],e[10])];
      if(actor!==undefined||skipAdd){if(actor!==undefined)bounds.actor=actor;return bounds;}
      add(bounds);return bounds;
    }
    function setActors(performers) {
      actorBoxes=[];actorGrid=new Map();var changed=false;
      if(!performers.length){actorCache.clear();actorRevision++;return;}
      performers.forEach(function(p){
        p.g.updateMatrixWorld(true);
        var key=p.g.matrixWorld.elements.join(',');
        ['armL','armR','elL','elR'].forEach(function(part){if(p[part])key+=','+p[part].quaternion.toArray().join(',');});
        var cached=actorCache.get(p.i);
        if(!cached||cached.key!==key){
          changed=true;cached={key:key,boxes:[]};p.g.traverse(function(mesh){if(mesh.isMesh&&mesh.geometry&&mesh.visible)cached.boxes.push(addMeshBounds(mesh.geometry,mesh.matrixWorld,true,p.i));});actorCache.set(p.i,cached);
        }
        cached.boxes.forEach(function(box){actorBoxes.push(box);index(box,actorGrid);});
      });
      if(changed)actorRevision++;
    }
    scene.updateMatrixWorld(true);
    // Static boxes, including stage, walls, pillars, platforms and lighting.
    // Exclude the enclosing room shell: its interior is handled separately.
    scene.children.forEach(function(child) {
      if(child.isMesh && !child.isInstancedMesh && child.geometry.type === 'BoxGeometry' && child.material.side !== THREE.BackSide){
        var bounds=addMeshBounds(child.geometry,child.matrixWorld,child.userData.ribbonBlocksTarget);
        if(child.userData.ribbonBarrier){bounds.barrier=true;barriers.push(bounds);}
      }
    });
    // Platforms are a separate static group. Instanced chairs and spectators use their actual matrices.
    room.platforms.children.forEach(function(child){ addMeshBounds(child.geometry,child.matrixWorld); });
    ['pad','back','torso','head','hair'].forEach(function(name){
      var im=instances[name];if(!im)return;im.geometry.computeBoundingBox();
      seats.forEach(function(_,i){ im.getMatrixAt(i,matrix); var person=addMeshBounds(im.geometry,matrix);person.instanceIndex=i;if(name==='torso'||name==='head'||name==='hair'){person.audience=i;person.instanceName=name;person.instanceIndex=i;} });
    });
    var empty=[], axes=['x','y','z'], faceAxis=['x','x','y','y','z','z'];
    var low=[-room.width/2,0,room.z-room.depth/2], high=[room.width/2,room.height,room.z+room.depth/2];
    var faces=new Float64Array(6), contact={hit:false,landed:false,actor:undefined,audience:undefined};
    var localPoint=new THREE.Vector3(), closest=new THREE.Vector3(), normal=new THREE.Vector3();
    // Reuse scratch storage: a rope may query this hundreds of times per step.
    function collide(p, velocity, radius,ignoreActor,snapshot,bodies) {
      contact.hit=false;contact.landed=false;contact.actor=undefined;contact.audience=undefined;
      for(var i=0;i<3;i++) {
        var axis=axes[i], value=Math.max(low[i]+radius,Math.min(high[i]-radius,p[axis]));
        if(value!==p[axis]) {
          p[axis]=value;if(velocity)velocity[axis]*=-.25;
          contact.hit=true;if(i===1 && value===radius)contact.landed=true;
        }
      }
      var cell=Math.floor(p.x)+':'+Math.floor(p.z);
      for(var group=0;group<2;group++){
      var nearby=(group?(snapshot?snapshot.grid:actorGrid):(bodies?bodies.grid:grid)).get(cell)||empty;
      for(var i=0;i<nearby.length;i++) {
        var b=nearby[i];if(b.actor!==undefined&&b.actor===ignoreActor)continue;
        if(p.x<b.min.x-radius || p.x>b.max.x+radius || p.y<b.min.y-radius || p.y>b.max.y+radius || p.z<b.min.z-radius || p.z>b.max.z+radius) continue;
        // AABB is only the broad phase: resolve against the mesh's oriented box.
        // Otherwise rotated chairs and lights create invisible solid corners.
        localPoint.copy(p).applyMatrix4(b.inverse);
        closest.copy(localPoint).clamp(b.localBounds.min,b.localBounds.max).applyMatrix4(b.transform);
        normal.subVectors(p,closest);
        var distance=normal.length();
        if(distance>radius) continue;
        if(distance>1e-8) {
          normal.multiplyScalar(1/distance);
          p.addScaledVector(normal,radius-distance);
        } else {
          faces[0]=(localPoint.x-b.localBounds.min.x)*b.scale[0];faces[1]=(b.localBounds.max.x-localPoint.x)*b.scale[0];
          faces[2]=(localPoint.y-b.localBounds.min.y)*b.scale[1];faces[3]=(b.localBounds.max.y-localPoint.y)*b.scale[1];
          faces[4]=(localPoint.z-b.localBounds.min.z)*b.scale[2];faces[5]=(b.localBounds.max.z-localPoint.z)*b.scale[2];
          var k=0;for(var j=1;j<6;j++)if(faces[j]<faces[k])k=j;
          normal.set(0,0,0);normal[faceAxis[k]]=k%2?1:-1;
          normal.applyMatrix3(b.normalMatrix).normalize();
          p.addScaledVector(normal,faces[k]+radius);
        }
        if(velocity) {
          var toward=velocity.dot(normal);
          if(toward<0)velocity.addScaledVector(normal,-1.25*toward);
          velocity.x*=.6;velocity.z*=.6;
        }
        contact.hit=true;if(b.actor!==undefined)contact.actor=b.actor;if(b.audience!==undefined)contact.audience=b.audience;if(normal.y>.5)contact.landed=true;
      }}
      return contact;
    }
    var sightStart=new THREE.Vector3(),sightEnd=new THREE.Vector3();
    function blocked(from,to,ignoreActor,snapshot,pickupSeat) {
      for(var group=0;group<2;group++){
      var list=group?(snapshot?snapshot.boxes:actorBoxes):boxes;
      for(var i=0;i<list.length;i++) {
        var b=list[i];if((pickupSeat===undefined?!b.blocksTarget:b.instanceIndex===pickupSeat)||b.actor!==undefined&&b.actor===ignoreActor)continue;
        if(Math.max(from.x,to.x)<b.min.x||Math.min(from.x,to.x)>b.max.x||Math.max(from.y,to.y)<b.min.y||Math.min(from.y,to.y)>b.max.y||Math.max(from.z,to.z)<b.min.z||Math.min(from.z,to.z)>b.max.z)continue;
        sightStart.copy(from).applyMatrix4(b.inverse);sightEnd.copy(to).applyMatrix4(b.inverse);
        var near=0,far=1;
        for(var j=0;j<3;j++) {
          var axis=axes[j],delta=sightEnd[axis]-sightStart[axis],min=b.localBounds.min[axis],max=b.localBounds.max[axis];
          if(Math.abs(delta)<1e-10){if(sightStart[axis]<min||sightStart[axis]>max){near=2;break;}continue;}
          var a=(min-sightStart[axis])/delta,c=(max-sightStart[axis])/delta;
          near=Math.max(near,Math.min(a,c));far=Math.min(far,Math.max(a,c));
          if(near>far)break;
        }
        if(near<=far&&far>1e-6&&near<1-1e-6)return true;
      }}
      return false;
    }
    function barrierCrosses(from,to) {
      for(var i=0;i<barriers.length;i++) {
        var b=barriers[i],near=0,far=1;
        for(var j=0;j<3;j++){
          var axis=axes[j],delta=to[axis]-from[axis];
          if(Math.abs(delta)<1e-10){if(from[axis]<b.min[axis]||from[axis]>b.max[axis]){near=2;break;}continue;}
          var a=(b.min[axis]-from[axis])/delta,c=(b.max[axis]-from[axis])/delta;
          near=Math.max(near,Math.min(a,c));far=Math.min(far,Math.max(a,c));if(near>far)break;
        }
        if(near<=far&&far>1e-6&&near<1-1e-6)return true;
      }return false;
    }
    function dropRoute(from,to,floorY) {
      var radius=.02,floor=from.clone(),slideTop=0;floor.y=floorY;
      barriers.forEach(function(b){if(floor.y<b.max.y+radius&&floor.y>b.min.y-radius&&floor.z>b.min.z-radius&&floor.z<b.max.z+radius&&floor.x>b.min.x-radius&&floor.x<b.max.x+radius){floor.x=floor.x<(b.min.x+b.max.x)/2?b.min.x-radius:b.max.x+radius;slideTop=Math.max(slideTop,b.max.y+radius);}});
      var contacts=[],separations=[],endSupportTop=0;
      for(var i=0;i<barriers.length;i++) {
        var b=barriers[i],center=(b.min.x+b.max.x)/2,sign=floor.x<center?-1:1,delta=to.x-floor.x;
        if(to.x>b.min.x-radius&&to.x<b.max.x+radius&&to.z>b.min.z&&to.z<b.max.z)endSupportTop=Math.max(endSupportTop,b.max.y+radius);
        if(sign<0&&to.x<=b.min.x-radius||sign>0&&to.x>=b.max.x+radius){separations.push({barrier:b,sign:sign,x:center+sign*((b.max.x-b.min.x)/2+radius)});continue;}
        var t=Math.max(0,Math.min(1,(center-floor.x)/(delta||1e-9))),z=floor.z+(to.z-floor.z)*t;
        if(z<=b.min.z||z>=b.max.z||Math.min(floor.y,to.y)>b.max.y+radius)continue;
        var inner=center+sign*((b.max.x-b.min.x)/2+radius),outer=center-sign*((b.max.x-b.min.x)/2+radius);
        contacts.push({barrier:b,sign:sign,t:t,guides:[new THREE.Vector3(inner,b.max.y+radius,z),new THREE.Vector3(outer,b.max.y+radius,z)]});
      }
      contacts.sort(function(a,b){return a.t-b.t;});var guides=[];contacts.forEach(function(c){guides.push(c.guides[0],c.guides[1]);});
      return {floor:floor,barrier:contacts.length?contacts[0].barrier:null,contacts:contacts,separations:separations,guides:guides,slideTop:slideTop,endSupportTop:endSupportTop};
    }
    var bodyA=new THREE.Vector3(),bodyB=new THREE.Vector3();
    function bodySegment(a,b,freeA,freeB,radius) {
      var hit=false;
      for(var x=Math.floor(Math.min(a.x,b.x)-radius);x<=Math.floor(Math.max(a.x,b.x)+radius);x++)for(var z=Math.floor(Math.min(a.z,b.z)-radius);z<=Math.floor(Math.max(a.z,b.z)+radius);z++){
        var nearby=grid.get(x+':'+z)||empty;
        for(var i=0;i<nearby.length;i++){
          var box=nearby[i];if(box.audience===undefined||Math.max(a.y,b.y)<box.min.y-radius||Math.min(a.y,b.y)>box.max.y+radius)continue;
          bodyA.copy(a).applyMatrix4(box.inverse);bodyB.copy(b).applyMatrix4(box.inverse);var near=0,far=1;
          for(var k=0;k<3;k++){var axis=axes[k],r=radius/box.scale[k],lo=box.localBounds.min[axis]-r,hi=box.localBounds.max[axis]+r,delta=bodyB[axis]-bodyA[axis];if(Math.abs(delta)<1e-9){if(bodyA[axis]<lo||bodyA[axis]>hi){near=2;break;}continue;}var t1=(lo-bodyA[axis])/delta,t2=(hi-bodyA[axis])/delta;near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));if(near>far)break;}
          if(near>far||far<=1e-6||near>=1-1e-6)continue;hit=true;
          // Drape free links over the body; fixed ends select a compatible separating face.
          var axis='y',sign=1,fixed=!freeA?bodyA:!freeB?bodyB:null,best=-Infinity;
          if(fixed)for(var preference=0;preference<2&&best===-Infinity;preference++)for(var k=0;k<3;k++){var key=axes[k];if(preference===0&&key==='y'||preference===1&&key!=='y')continue;var r=(radius+.002)/box.scale[k],below=box.localBounds.min[key]-r-fixed[key],above=fixed[key]-box.localBounds.max[key]-r;if(below>best&&below>=0){best=below;axis=key;sign=-1;}if(above>best&&above>=0){best=above;axis=key;sign=1;}}
          var edge=sign<0?box.localBounds.min[axis]-(radius+.002)/box.scale[axes.indexOf(axis)]:box.localBounds.max[axis]+(radius+.002)/box.scale[axes.indexOf(axis)];
          if(freeA){bodyA[axis]=sign<0?Math.min(bodyA[axis],edge):Math.max(bodyA[axis],edge);a.copy(bodyA).applyMatrix4(box.transform);}
          if(freeB){bodyB[axis]=sign<0?Math.min(bodyB[axis],edge):Math.max(bodyB[axis],edge);b.copy(bodyB).applyMatrix4(box.transform);}
        }
      }return hit;
    }
    function updateAudience(id,matrices){var changed=false;for(var i=0;i<boxes.length;i++){var old=boxes[i],transform=matrices[old.instanceName];if(old.audience!==id||!transform||old.transform.equals(transform))continue;var b=addMeshBounds(old.geometry,transform,old.blocksTarget,undefined,true);b.audience=id;b.instanceName=old.instanceName;b.instanceIndex=old.instanceIndex;boxes[i]=b;changed=true;}if(changed){grid=new Map();boxes.forEach(function(b){index(b,grid);});actorRevision++;}}
    return {boxes:boxes, collide:collide,updateAudience:updateAudience,snapshotBodies:function(){return {grid:grid};},bodyCrosses:function(a,b){return bodySegment(a,b,false,false,0);},constrainBodySegment:bodySegment,blocked:blocked,pickupBlocked:function(from,to,seat,owner){return blocked(from,to,owner,null,seat);},setActors:setActors,barrierCrosses:barrierCrosses,dropRoute:dropRoute,actorBounds:function(){return actorBoxes;},actorRevision:function(){return actorRevision;},snapshotActors:function(){return {grid:actorGrid,boxes:actorBoxes,revision:actorRevision};}};
  };
})(typeof window==='undefined'?globalThis:window);
