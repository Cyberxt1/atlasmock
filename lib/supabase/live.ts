import {createClient,isSupabaseConfigured} from './client';
import type {Category,Incident,Responder} from '@/lib/data';
import type {Organization} from '@/lib/platform';

type IncidentRow={id:string;reference:string;category:string;severity:string;title:string;description:string|null;location_name:string;status:string;created_at:string;organization_id:string};
type ResponderRow={id:string;unit_code:string;response_role:string;team:string;duty_status:string;battery:number|null;organization_id:string};
const statusFromDb=(value:string)=>value.split('_').map(x=>x[0]?.toUpperCase()+x.slice(1)).join(' ');
const statusToDb=(value:string)=>value.toLowerCase().replaceAll(' ','_');

export async function redeemLiveCode(code:string){
 if(!isSupabaseConfigured)return null;
 const client=createClient();if(!client)return null;
 const session=await client.auth.getSession();
 if(!session.data.session){const signed=await client.auth.signInAnonymously();if(signed.error)throw signed.error}
 const result=await client.rpc('redeem_access_code',{raw_code:code.trim().toUpperCase()});
 if(result.error)throw result.error;
 const row=Array.isArray(result.data)?result.data[0]:result.data;
 if(!row)throw new Error('The access code could not be redeemed.');
 const org=await client.from('organizations').select('id,name,slug,status,contact_email,campus_name,created_at').eq('id',row.organization_id).single();
 if(org.error)throw org.error;
 return {organization:{id:org.data.id,name:org.data.name,slug:org.data.slug,status:org.data.status==='active'?'Active':org.data.status==='trial'?'Trial':'Suspended',contactEmail:org.data.contact_email,campus:org.data.campus_name,userCode:'',responderCode:'',createdAt:new Date(org.data.created_at).getTime(),users:0,responders:0,incidents:0} as Organization,role:row.granted_role as string};
}

export async function createLiveIncident(input:{organizationId:string;category:Category;severity:string;title:string;description:string;location:string}){
 const client=createClient();if(!client)return null;
 const reference=`AU-${String(Date.now()).slice(-6)}`;
 const result=await client.from('incidents').insert({organization_id:input.organizationId,reference,category:input.category,severity:input.severity,title:input.title,description:input.description||null,location_name:input.location,status:'new'}).select().single();
 if(result.error)throw result.error;
 return incidentFromRow(result.data as IncidentRow);
}
export function incidentFromRow(row:IncidentRow):Incident{return {id:row.reference,title:row.title,type:row.category as Category,severity:row.severity,location:row.location_name,status:statusFromDb(row.status),created:new Date(row.created_at).getTime(),assigned:[],eta:5,caller:'Verified campus user',notes:row.description?[`Reporter: ${row.description}`]:[],timeline:['Emergency request received from Atlas mobile']}}
export function responderFromRow(row:ResponderRow):Responder{return {id:row.unit_code,name:row.unit_code,role:row.response_role as Category,team:row.team,status:statusFromDb(row.duty_status),location:'Location sharing active',phone:'',battery:row.battery??100,organizationId:row.organization_id}}
export async function listLiveIncidents(organizationId:string){const client=createClient();if(!client)return [];const result=await client.from('incidents').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false});if(result.error)throw result.error;return (result.data as IncidentRow[]).map(incidentFromRow)}
export async function updateLiveIncident(reference:string,status:string){const client=createClient();if(!client)return;const result=await client.from('incidents').update({status:statusToDb(status),resolved_at:status==='Resolved'?new Date().toISOString():null}).eq('reference',reference);if(result.error)throw result.error}
export async function setLiveDuty(status:'available'|'offline'){const client=createClient();if(!client)return;const user=await client.auth.getUser();if(!user.data.user)throw new Error('Responder session missing');const result=await client.from('responders').update({duty_status:status,updated_at:new Date().toISOString()}).eq('profile_id',user.data.user.id);if(result.error)throw result.error}
export function subscribeToIncidents(organizationId:string,onChange:()=>void){const client=createClient();if(!client)return()=>{};const channel=client.channel(`incidents:${organizationId}`).on('postgres_changes',{event:'*',schema:'public',table:'incidents',filter:`organization_id=eq.${organizationId}`},onChange).subscribe();return()=>{void client.removeChannel(channel)}}
