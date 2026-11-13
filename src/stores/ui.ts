import { create } from 'zustand';
export const useUi=create<{theme:'dark'|'light';detailWidth:number;toggleTheme:()=>void;setDetailWidth:(width:number)=>void}>((set)=>({
  theme:'dark',detailWidth:320,toggleTheme:()=>set(state=>({theme:state.theme==='dark'?'light':'dark'})),
  setDetailWidth:width=>{if(Number.isFinite(width))set({detailWidth:Math.max(260,Math.min(560,Math.round(width)))});},
}));
