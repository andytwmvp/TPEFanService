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
    scene.updateMatrixWorld(true);
    // Static boxes, including stage, walls, pillars, platforms and lighting.
    // Exclude the enclosing room shell: its interior is handled separately.
    scene.children.forEach(function(child) {
      if(child.isMesh && !child.isInstancedMesh && child.geometry.type === 'BoxGeometry' && child.material.side !== THREE.BackSide)
        add(new THREE.Box3().setFromObject(child));
    });
    // Platforms are a separate static group. Instanced chairs and spectators use their actual matrices.
    room.platforms.children.forEach(function(child){ add(new THREE.Box3().setFromObject(child)); });
    ['pad','back','torso','head'].forEach(function(name){
      var im=instances[name]; im.geometry.computeBoundingBox();
      seats.forEach(function(_,i){ im.getMatrixAt(i,matrix); add(im.geometry.boundingBox.clone().applyMatrix4(matrix)); });
    });
    var empty=[], axes=['x','y','z'], faceAxis=['x','x','y','y','z','z'];
    var low=[-room.width/2,0,room.z-room.depth/2], high=[room.width/2,room.height,room.z+room.depth/2];
    var faces=new Float64Array(6), contact={hit:false,landed:false};
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
        faces[0]=p.x-b.min.x+radius;faces[1]=b.max.x+radius-p.x;
        faces[2]=p.y-b.min.y+radius;faces[3]=b.max.y+radius-p.y;
        faces[4]=p.z-b.min.z+radius;faces[5]=b.max.z+radius-p.z;
        var k=0;for(var j=1;j<6;j++)if(faces[j]<faces[k])k=j;
        var axis=faceAxis[k], sign=k%2?1:-1;
        p[axis]+=sign*faces[k];
        if(velocity){velocity[axis]=sign*Math.abs(velocity[axis])*.25;velocity.multiplyScalar(.6);}
        contact.hit=true;if(k===3)contact.landed=true;
      }
      return contact;
    }
    return {boxes:boxes, collide:collide};
  };
})(typeof window==='undefined'?globalThis:window);
