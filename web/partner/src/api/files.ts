import {apiClient} from './client';
export async function uploadFile(file:File):Promise<string>{
  const form=new FormData();form.append('file',file);
  const {data}=await apiClient.post<{url:string}>('/files',form);
  return data.url;
}
export async function fileUrl(reference:string):Promise<string>{
  if(!reference.startsWith('/api/v1/files/'))return reference;
  const {data}=await apiClient.get<{url:string}>(`${reference.slice('/api/v1'.length)}/url`);
  return data.url;
}
