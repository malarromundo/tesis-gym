import {createContext,useContext,useEffect,useState} from 'react';
import {api,get} from './api';
const Auth=createContext();
export const useAuth=()=>useContext(Auth);
export function AuthProvider({children}){
  const [user,setUser]=useState(null),[loading,setLoading]=useState(true);
  const logout=()=>{localStorage.removeItem('rt-token');setUser(null);};
  useEffect(()=>{let mounted=true;if(localStorage.getItem('rt-token'))get('/api/auth/me').then(u=>mounted&&setUser(u)).catch(logout).finally(()=>mounted&&setLoading(false));else setLoading(false);window.addEventListener('rt-unauthorized',logout);return()=>{mounted=false;window.removeEventListener('rt-unauthorized',logout);};},[]);
  const login=async(email,password)=>{const {data}=await api.post('/api/auth/login',{email,password});if(typeof data?.token!=='string'||!data.user?.id||!['ADMIN','TRAINER','ATHLETE'].includes(data.user.role))throw new Error('Respuesta de login inválida. Verificá que el servidor sea RutinaTrack.');localStorage.setItem('rt-token',data.token);setUser(data.user);};
  return <Auth.Provider value={{user,loading,login,logout}}>{children}</Auth.Provider>;
}
