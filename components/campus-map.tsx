'use client';
import {useEffect,useRef,useState} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CircleAlert, Cross, Flame, LocateFixed, Maximize2, Minus, Plus, ShieldCheck, Users} from 'lucide-react';
import type {Map as LeafletMap} from 'leaflet';
import type {Incident,Responder} from '@/lib/data';
const center:[number,number]=[7.7600,4.4625];
const pois:[string,number,number][]=[['Engineering Complex',.0014,-.0026],['Library',.00128,.0003],['Student Hostel A',.00122,.0027],['Student Hostel B',.00035,.00305],['Sports Complex',-.00065,.00285],['Main Gate',-.00145,-.0008],['Admin Centre',-.00067,-.0018]];
export default function CampusMap({incidents,responders,filter='All',onIncident,onResponder,full=false}:{incidents:Incident[];responders:Responder[];filter?:string;onIncident:(id:string)=>void;onResponder:(id:string)=>void;full?:boolean}){
 const container=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
 const handlers=useRef({onIncident,onResponder});handlers.current={onIncident,onResponder};
 useEffect(()=>{let disposed=false;let observer:ResizeObserver;
  import('leaflet').then(L=>{if(disposed||!container.current)return;const instance=L.map(container.current,{zoomControl:false,attributionControl:true,scrollWheelZoom:true}).setView(center,16.6);map.current=instance;
   instance.attributionControl.setPrefix(false);
   const tiles=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri · Earthstar Geographics',className:'satellite-tiles'}).addTo(instance);
   tiles.on('tileerror',()=>setFailed(true));tiles.on('load',()=>setReady(true));setReady(true);
   observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(container.current);
  });return()=>{disposed=true;observer?.disconnect();map.current?.remove();map.current=null;};
 },[]);
 useEffect(()=>{if(!ready||!map.current)return;let disposed=false;let group:import('leaflet').LayerGroup;
 import('leaflet').then(L=>{if(disposed||!map.current)return;group=L.layerGroup().addTo(map.current);
  const marker=(pos:[number,number],html:string,cls:string,title:string,onClick?:()=>void)=>{const m=L.marker(pos,{icon:L.divIcon({className:cls,html,iconSize:cls==='poi'? [180,24]:[48,58],iconAnchor:cls==='poi'?[7,12]:[24,48]}),title,keyboard:true}).addTo(group);if(onClick)m.on('click',onClick);return m;};
  pois.forEach(([name,lat,lng])=>marker([center[0]+lat,center[1]+lng],`<i></i><span>${name}</span>`,'poi',name));
  marker([center[0]-.0001,center[1]-.0001],'<span>Adeleke<br/>University</span>','campus-name','Adeleke University');
  incidents.filter(a=>!['Resolved','Cancelled'].includes(a.status)&&(filter==='All'||filter===a.type)).forEach((a,i)=>{const p=a.coordinates||(a.type==='Medical'?[center[0]+.0005+i*.00012,center[1]-.0012]:[center[0]-.00045+i*.00012,center[1]-.00165]);marker(p as [number,number],`<div class="marker-drop ${a.type.toLowerCase()} ${a.type==='Medical'?'incident-pulse':''}">${renderToStaticMarkup(a.type==='Medical'?<CircleAlert/>:<ShieldCheck/>)}</div>`,'dispatch-marker',a.title,()=>handlers.current.onIncident(a.id));});
  const display=responders.filter(r=>r.status!=='Offline'&&(filter==='All'||filter===r.role));
  const samples=filter==='All'?display.filter(r=>['R-001','R-003'].includes(r.id)):display.slice(0,4);
  samples.forEach((r,i)=>marker(r.coordinates||[center[0]+(r.role==='Fire'?0:.00095-i*.0009),center[1]+(r.role==='Fire'?.0027:0+i*.0005)],`<div class="marker-drop ${r.role==='Fire'?'fire':'responder'}">${renderToStaticMarkup(r.role==='Fire'?<Flame/>:r.role==='Security'?<ShieldCheck/>:<Users/>)}</div>`,'dispatch-marker',`${r.id} · ${r.team} · ${r.status}`,()=>handlers.current.onResponder(r.id)));
 });return()=>{disposed=true;group?.remove()};
 },[ready,filter,incidents,responders]);
 return <div className={`map-stage ${full?'full-map':''}`}><div ref={container} className="leaflet-host" aria-label="Interactive Adeleke University campus map"/>{!ready&&<div className="map-loading">Loading campus map…</div>}{failed&&<button className="map-warning" onClick={()=>{map.current?.eachLayer(layer=>{if('redraw' in layer)(layer as {redraw:()=>void}).redraw()});setFailed(false)}}>Map connection interrupted · Retry</button>}<div className="map-controls"><button aria-label="Zoom in" onClick={()=>map.current?.zoomIn()}><Plus/></button><button aria-label="Zoom out" onClick={()=>map.current?.zoomOut()}><Minus/></button><button aria-label="Recenter campus" onClick={()=>map.current?.setView(center,16.6)}><LocateFixed/></button></div><div className="map-legend"><span><i className="dot red"/>Active Alert</span><span><i className="dot green"/>Responder</span><span><i className="dot pale"/>Campus Location</span></div></div>
}
