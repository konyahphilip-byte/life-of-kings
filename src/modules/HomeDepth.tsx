import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { Leaf } from 'lucide-react';
import type { Group, Mesh } from 'three';

function useReducedMotion(){
  const [reduced,setReduced]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  return reduced;
}
function LeafObject({pointer}:{pointer:MutableRefObject<{x:number;y:number}>}){
  const group=useRef<Group>(null);const leaf=useRef<Mesh>(null);const orb=useRef<Mesh>(null);
  const {shape,vein}=useMemo(()=>{
    const form=new THREE.Shape();form.moveTo(0,-1.18);form.bezierCurveTo(.98,-.86,1.34,.19,0,1.26);form.bezierCurveTo(-1.26,.54,-1.01,-.79,0,-1.18);form.closePath();
    const geometry=new THREE.ExtrudeGeometry(form,{depth:.17,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:.065,bevelThickness:.065,curveSegments:28});geometry.computeVertexNormals();
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,-1.11,.255),new THREE.Vector3(.045,-.54,.27),new THREE.Vector3(-.03,.12,.27),new THREE.Vector3(0,.72,.25),new THREE.Vector3(0,1.18,.14)]);
    const veinGeometry=new THREE.TubeGeometry(curve,32,.014,7,false);return{shape:geometry,vein:veinGeometry};
  },[]);
  useFrame(({clock},delta)=>{
    const t=clock.elapsedTime;
    if(group.current){group.current.rotation.x=THREE.MathUtils.damp(group.current.rotation.x,-pointer.current.y*.28,4,delta);group.current.rotation.y=THREE.MathUtils.damp(group.current.rotation.y,pointer.current.x*.38,4,delta);group.current.rotation.z=THREE.MathUtils.damp(group.current.rotation.z,-pointer.current.x*.08,4,delta);}
    if(orb.current)orb.current.rotation.y=t*.09;
  });
  return <group ref={group}>
    <mesh ref={orb} scale={1.18}><sphereGeometry args={[1,48,48]}/><meshPhysicalMaterial color="#6ebd73" roughness={.22} metalness={.08} clearcoat={1} clearcoatRoughness={.1} transmission={.16} thickness={.48} transparent opacity={.23}/></mesh>
    <mesh ref={leaf} geometry={shape} castShadow receiveShadow rotation={[.06,0,-.17]}><meshPhysicalMaterial color="#54a965" roughness={.19} metalness={.04} clearcoat={1} clearcoatRoughness={.12} sheen={.42} sheenColor="#c9ffd2"/></mesh>
    <mesh geometry={vein} rotation={[.06,0,-.17]}><meshStandardMaterial color="#c8f39d" emissive="#4d923f" emissiveIntensity={.13} roughness={.34}/></mesh>
    <mesh position={[0,-1.27,.17]} rotation={[0,0,-.04]}><cylinderGeometry args={[.018,.035,.32,12]}/><meshPhysicalMaterial color="#3e804d" roughness={.31} clearcoat={.6}/></mesh>
    <mesh rotation={[.82,.18,.34]}><torusGeometry args={[1.55,.009,8,120]}/><meshBasicMaterial color="#a6d58b" transparent opacity={.38}/></mesh>
    <mesh rotation={[1.12,-.35,-.18]}><torusGeometry args={[1.72,.006,8,120]}/><meshBasicMaterial color="#a29bfe" transparent opacity={.27}/></mesh>
  </group>;
}
function FrameDriver({enabled}:{enabled:boolean}){
  const invalidate=useThree(state=>state.invalidate);
  useEffect(()=>{if(!enabled)return;let frame=0;let last=0;const tick=(time:number)=>{if(time-last>=1000/60){invalidate();last=time;}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[enabled,invalidate]);
  return null;
}
function StaticLeaf(){return <div className="home-depth-static" aria-hidden="true"><span className="depth-static-orbit orbit-one"/><span className="depth-static-orbit orbit-two"/><span className="depth-static-glass"><Leaf size={57}/></span></div>}
export default function HomeDepth(){
  const reduced=useReducedMotion();const host=useRef<HTMLDivElement>(null);const pointer=useRef({x:0,y:0});const [visible,setVisible]=useState(true);
  useEffect(()=>{const element=host.current;if(!element||!('IntersectionObserver'in window))return;const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{threshold:.03});observer.observe(element);return()=>observer.disconnect();},[]);
  const move=(event:React.PointerEvent<HTMLDivElement>)=>{const box=event.currentTarget.getBoundingClientRect();pointer.current.x=THREE.MathUtils.clamp(((event.clientX-box.left)/box.width-.5)*2,-1,1);pointer.current.y=THREE.MathUtils.clamp(((event.clientY-box.top)/box.height-.5)*2,-1,1);};
  const reset=()=>{pointer.current.x=0;pointer.current.y=0;};
  return <div ref={host} className="home-depth" role="img" aria-label="A polished green leaf floating in a glass orb" onPointerMove={move} onPointerLeave={reset}><StaticLeaf/>{!reduced&&<Canvas className="home-depth-canvas" dpr={[1,1.5]} frameloop="demand" camera={{position:[0,0,5.2],fov:38}} gl={{alpha:true,antialias:true,powerPreference:'low-power'}} fallback={null}><Suspense fallback={null}><FrameDriver enabled={visible}/><ambientLight intensity={.72}/><directionalLight position={[-3.5,5,4]} intensity={2.5} color="#f2ffe7"/><pointLight position={[3,-1,2]} intensity={1.1} color="#81df94"/><pointLight position={[-3,-2,-1]} intensity={.45} color="#8982ff"/><Float speed={.55} rotationIntensity={.1} floatIntensity={.07} floatingRange={[-.05,.05]}><LeafObject pointer={pointer}/></Float></Suspense></Canvas>}</div>;
}
