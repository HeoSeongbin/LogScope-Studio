import type { ExportArtifact } from './export';
export function downloadArtifact(artifact:ExportArtifact){
  const url=URL.createObjectURL(artifact.blob);const anchor=document.createElement('a');
  try{anchor.href=url;anchor.download=artifact.filename;document.body.append(anchor);anchor.click();}
  finally{anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
