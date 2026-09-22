'use client';
import {usePathname} from 'next/navigation';
import Atlas from './atlas';
import MobileExperience from './mobile-experience';
import SuperAdmin from './super-admin';

export default function PortalRouter(){
 const path=usePathname();
 if(path.startsWith('/admin'))return <SuperAdmin/>;
 if(path.startsWith('/user'))return <MobileExperience mode="user"/>;
 if(path.startsWith('/responder'))return <MobileExperience mode="responder"/>;
 return <Atlas/>;
}
