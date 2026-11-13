import { afterEach, expect, it, vi } from 'vitest';
import { downloadArtifact } from '../core/download';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
it('releases the local download URL and removes its temporary anchor',()=>{
  vi.useFakeTimers();const create=vi.fn(()=> 'blob:local'),revoke=vi.fn();vi.stubGlobal('URL',{createObjectURL:create,revokeObjectURL:revoke});
  let filename='';vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){filename=this.download;expect(this.href).toBe('blob:local');});
  downloadArtifact({blob:new Blob(['local']),filename:'logscope-events.json',bytes:5,rows:1});expect(filename).toBe('logscope-events.json');expect(document.querySelector('a[download]')).toBeNull();vi.advanceTimersByTime(1000);expect(revoke).toHaveBeenCalledWith('blob:local');
});
