'use client';
import {usePathname} from 'next/navigation';
import DispatcherShell from './dispatcher-shell';
import MobileExperience from './mobile-experience';
import SuperAdmin from './super-admin';

export default function PortalRouter(){
 const path=usePathname();
 if(path==='/admin'||path.startsWith('/admin/'))return <SuperAdmin/>;
 if(path==='/user'||path.startsWith('/user/'))return <MobileExperience mode="user"/>;
 if(path==='/responder'||path.startsWith('/responder/'))return <MobileExperience mode="responder"/>;
 return <DispatcherShell/>;
}
