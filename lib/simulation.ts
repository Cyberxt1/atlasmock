import type {ActivityEvent,Category,Incident,Responder} from './data';

export const TICK_MS=8000;
export const ARRIVAL_MS=24000;
export const MAX_ACTIVE=6;
export type Simulation={running:boolean;clock:number;nextArrival:number;sequence:number;autoProgress:boolean};
export const initialSimulation:Simulation={running:true,clock:0,nextArrival:TICK_MS,sequence:0,autoProgress:true};
export type SimulationSnapshot={incidents:Incident[];responders:Responder[];simulation:Simulation};
export type SimulationResult=SimulationSnapshot & {events:ActivityEvent[]};
const isActive=(a:Incident)=>!['Resolved','Cancelled'].includes(a.status);
const scenarios:{title:string;type:Category;severity:string;location:string;caller:string;coordinates:[number,number]}[]=[
 {title:'Student needs first aid',type:'Medical',severity:'Critical',location:'Sports Complex',caller:'Damilola Ojo · Student',coordinates:[7.7594,4.4651]},
 {title:'Unauthorised access reported',type:'Security',severity:'High',location:'Main Gate',caller:'Babatunde Lawal · Security desk',coordinates:[7.7586,4.4617]},
 {title:'Smoke detector activated',type:'Fire',severity:'Critical',location:'Cafeteria',caller:'Aisha Bello · Staff',coordinates:[7.7607,4.4641]},
 {title:'Student welfare check',type:'General',severity:'Standard',location:'Student Hostel A',caller:'Ngozi Eze · Hall supervisor',coordinates:[7.7612,4.465]},
 {title:'Medical assistance requested',type:'Medical',severity:'High',location:'Main Library',caller:'Favour Adeola · Student',coordinates:[7.761,4.4629]},
 {title:'Security escort requested',type:'Security',severity:'Standard',location:'Admin Centre',caller:'Samuel James · Staff',coordinates:[7.7594,4.4608]}
];
function event(a:Incident,title:string,clock:number,now:number,type=a.type):ActivityEvent{return {id:`${a.id}-${clock}-${title}`,title,detail:`${a.id} · ${a.location}`,type,age:0,created:now,read:false,incidentId:a.id}}

export function injectAlert(snapshot:SimulationSnapshot,now:number,category?:Category):SimulationResult{
 const {incidents,responders,simulation}=snapshot;
 if(incidents.filter(isActive).length>=MAX_ACTIVE)return {...snapshot,events:[]};
 const options=category?scenarios.filter(s=>s.type===category):scenarios;
 const scenario=options[simulation.sequence%options.length];
 const number=Math.max(1042,...incidents.map(a=>Number(a.id.split('-')[1])||0))+1;
 const incident:Incident={...scenario,id:`AU-${number}`,status:'New',created:now,assigned:[],eta:5,notes:[],timeline:['Simulated emergency request received'],simulated:true,simulationDue:simulation.clock+TICK_MS};
 return {incidents:[incident,...incidents],responders,simulation:{...simulation,sequence:simulation.sequence+1},events:[event(incident,`New ${incident.type.toLowerCase()} alert: ${incident.title}`,simulation.clock,now)]};
}

// The clock advances only while running. Pausing never schedules a backlog.
export function advanceSimulation(snapshot:SimulationSnapshot,now:number):SimulationResult{
 if(!snapshot.simulation.running)return {...snapshot,events:[]};
 const simulation={...snapshot.simulation,clock:snapshot.simulation.clock+TICK_MS};
 let incidents=snapshot.incidents.map(a=>({...a}));
 let responders=snapshot.responders.map(r=>({...r}));
 const events:ActivityEvent[]=[];
 if(simulation.autoProgress){
  for(const a of incidents){
   if(!a.simulated||!isActive(a)||(a.simulationDue??0)>simulation.clock)continue;
   let status=a.status;
   if(a.status==='New')status='Acknowledged';
   else if(a.status==='Acknowledged'){
    const r=responders.find(r=>['Available','On Call'].includes(r.status)&&(r.role===a.type||(a.type==='General'&&r.role==='Security'))&&!incidents.some(other=>isActive(other)&&other.assigned.includes(r.id)));
    if(!r)continue;
    a.assigned=[r.id];r.status='Busy';status='Assigned';
   }else if(a.status==='Assigned')status='En Route';
   else if(a.status==='En Route')status='On Scene';
   else if(a.status==='On Scene')status='Resolved';
   if(status===a.status)continue;
   a.status=status;a.simulationDue=simulation.clock+TICK_MS;
   a.eta=status==='En Route'?2:status==='On Scene'||status==='Resolved'?0:a.eta;
   a.timeline=[...a.timeline,`${status} · simulated response`];
   if(status==='Resolved')a.outcome='Assistance provided (simulation)';
   responders=responders.map(r=>a.assigned.includes(r.id)?{...r,location:a.location,status:status==='Resolved'?(incidents.some(other=>other.id!==a.id&&isActive(other)&&other.assigned.includes(r.id))?r.status:'Available'):status==='En Route'?'En Route':'Busy'}:r);
   events.push(event(a,status==='Resolved'?'Incident resolved — responders available':status==='On Scene'?'Responder arrived on scene':status==='En Route'?`${a.assigned.join(', ')} en route`:status==='Assigned'?`${a.assigned.join(', ')} assigned`:'Alert acknowledged',simulation.clock,now));
  }
 }
 let result:SimulationResult={incidents,responders,simulation,events};
 if(simulation.clock>=simulation.nextArrival){
  const incoming=injectAlert(result,now);
  result={...incoming,events:[...events,...incoming.events],simulation:{...incoming.simulation,nextArrival:simulation.clock+ARRIVAL_MS}};
 }
 return result;
}
