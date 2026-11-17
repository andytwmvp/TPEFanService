const THREE=require('three'),assert=require('node:assert/strict');require('../ribbon-world.js');
const scene=new THREE.Scene(),wall=new THREE.Mesh(new THREE.BoxGeometry(.05,2,2),new THREE.MeshBasicMaterial());wall.userData.ribbonBlocksTarget=true;wall.rotation.y=Math.PI/4;wall.position.set(2,1,0);scene.add(wall);
const empty=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial(),0),world=new global.RibbonWorld(THREE,scene,{pad:empty,back:empty,torso:empty,head:empty},[],{width:20,height:10,depth:20,z:0,platforms:new THREE.Group()});
const corner=new THREE.Vector3(2.6,1,-.6);assert.equal(world.collide(corner,null,.03).hit,false,'empty corner of rotated AABB must not be an invisible obstacle');
const inside=new THREE.Vector3(2,1,0),velocity=new THREE.Vector3(1,0,-1);assert(world.collide(inside,velocity,.03).hit,'visible rotated wall still collides');
const local=wall.worldToLocal(inside.clone());assert(Math.abs(local.x)>=.0549,'contact pushed outside actual wall, including roll radius');
console.log('rotated obstacle bounds: no invisible AABB corners; actual oriented wall collision passed');

assert(world.blocked(new THREE.Vector3(1,1,1),new THREE.Vector3(3,1,-1)),'pillar blocks sight and catch across its solid volume');
assert(!world.blocked(new THREE.Vector3(-2,1,3),new THREE.Vector3(-2,1,-3)),'unobstructed direction remains usable');
