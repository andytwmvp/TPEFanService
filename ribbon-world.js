/* TPE scene adapter. Collision bounds come from the rendered TPE meshes;
 * no coordinates or invisible obstacles from the reference theatre are used. */
(function(root) {
  'use strict';
  root.RibbonWorld = function(THREE, scene, instances, seats, room) {
    var boxes = [], grid = new Map(), matrix = new THREE.Matrix4();
    function add(box) {
      if (box.isEmpty() || box.min.distanceToSquared(box.max)<1e-12) return;
      boxes.push(box);
      for (var x=Math.floor(box.min.x-.04);x<=Math.floor(box.max.x+.04);x++)
        for(var z=Math.floor(box.min.z-.04);z<=Math.floor(box.max.z+.04);z++) {
          var key=x+':'+z;
          if(!grid.has(key)) grid.set(key,[]);
          grid.get(key).push(box);
        }
    }
    function addMeshBounds(geometry, transform, blocksTarget) {
      geometry.computeBoundingBox();
      var bounds=geometry.boundingBox.clone().applyMatrix4(transform);
      bounds.blocksTarget=!!blocksTarget;
      bounds.localBounds=geometry.boundingBox.clone();
      bounds.transform=transform.clone();
      bounds.inverse=transform.clone().invert();
      bounds.normalMatrix=new THREE.Matrix3().getNormalMatrix(transform);
      var e=transform.elements;
      bounds.scale=[Math.hypot(e[0],e[1],e[2]),Math.hypot(e[4],e[5],e[6]),Math.hypot(e[8],e[9],e[10])];
      add(bounds);
    }
    scene.updateMatrixWorld(true);
    // Static boxes, including stage, walls, pillars, platforms and lighting.
    // Exclude the enclosing room shell: its interior is handled separately.
    scene.children.forEach(function(child) {
      if(child.isMesh && !child.isInstancedMesh && child.geometry.type === 'BoxGeometry' && child.material.side !== THREE.BackSide)
        addMeshBounds(child.geometry,child.matrixWorld,child.userData.ribbonBlocksTarget);
    });
    // Platforms are a separate static group. Instanced chairs and spectators use their actual matrices.
    room.platforms.children.forEach(function(child){ addMeshBounds(child.geometry,child.matrixWorld); });
    ['pad','back','torso','head'].forEach(function(name){
      var im=instances[name]; im.geometry.computeBoundingBox();
      seats.forEach(function(_,i){ im.getMatrixAt(i,matrix); addMeshBounds(im.geometry,matrix); });
    });
    var empty=[], axes=['x','y','z'], faceAxis=['x','x','y','y','z','z'];
    var low=[-room.width/2,0,room.z-room.depth/2], high=[room.width/2,room.height,room.z+room.depth/2];
    var faces=new Float64Array(6), contact={hit:false,landed:false};
    var localPoint=new THREE.Vector3(), closest=new THREE.Vector3(), normal=new THREE.Vector3();
    // Reuse scratch storage: a rope may query this hundreds of times per step.
    function collide(p, velocity, radius) {
      contact.hit=false;contact.landed=false;
      for(var i=0;i<3;i++) {
        var axis=axes[i], value=Math.max(low[i]+radius,Math.min(high[i]-radius,p[axis]));
        if(value!==p[axis]) {
          p[axis]=value;if(velocity)velocity[axis]*=-.25;
          contact.hit=true;if(i===1 && value===radius)contact.landed=true;
        }
      }
      var nearby=grid.get(Math.floor(p.x)+':'+Math.floor(p.z)) || empty;
      for(var i=0;i<nearby.length;i++) {
        var b=nearby[i];
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
        contact.hit=true;if(normal.y>.5)contact.landed=true;
      }
      return contact;
    }
    var sightStart=new THREE.Vector3(),sightEnd=new THREE.Vector3();
    function blocked(from,to) {
      for(var i=0;i<boxes.length;i++) {
        var b=boxes[i];if(!b.blocksTarget)continue;
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
      }
      return false;
    }
    return {boxes:boxes, collide:collide,blocked:blocked};
  };
})(typeof window==='undefined'?globalThis:window);
