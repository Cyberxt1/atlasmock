export type OrganizationStatus='Active'|'Trial'|'Suspended';
export type Organization={id:string;name:string;slug:string;status:OrganizationStatus;contactEmail:string;campus:string;userCode:string;responderCode:string;createdAt:number;users:number;responders:number;incidents:number;geofence?:{lat:number;lng:number;radius:number}};
export const demoOrganizations:Organization[]=[
 {id:'org-adeleke',name:'Adeleke University',slug:'adeleke-university',status:'Active',contactEmail:'safety@adelekeuniversity.edu.ng',campus:'Ede, Osun State',userCode:'ADELEKE-4820',responderCode:'RESP-AU-001',createdAt:Date.now()-86400000*91,users:4820,responders:14,incidents:128,geofence:{lat:7.76,lng:4.4625,radius:1200}},
 {id:'org-demo-2',name:'Northbridge College',slug:'northbridge-college',status:'Trial',contactEmail:'admin@northbridge.edu',campus:'Main Campus',userCode:'NORTH-2184',responderCode:'RESP-NC-001',createdAt:Date.now()-86400000*8,users:2184,responders:8,incidents:23,geofence:{lat:6.5244,lng:3.3792,radius:900}}
];
export const ORGANIZATIONS_KEY='atlas-organizations-v1';
export function generateCode(prefix:string){const clean=prefix.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)||'ATLAS';return `${clean}-${crypto.getRandomValues(new Uint32Array(1))[0].toString().slice(-6).padStart(6,'0')}`}
export function readOrganizations(){if(typeof window==='undefined')return demoOrganizations;try{const value=localStorage.getItem(ORGANIZATIONS_KEY);return value?JSON.parse(value) as Organization[]:demoOrganizations}catch{return demoOrganizations}}
export function saveOrganizations(value:Organization[]){localStorage.setItem(ORGANIZATIONS_KEY,JSON.stringify(value));window.dispatchEvent(new Event('atlas-organizations-change'))}
export function redeemDemoCode(code:string,role:'user'|'responder'){const normalized=code.trim().toUpperCase();return readOrganizations().find(org=>(role==='user'?org.userCode:org.responderCode)===normalized&&org.status!=='Suspended')}
