import {apiClient} from './client';
export async function uploadFile(file:File):Promise<string>{
  const form=new FormData();form.append('file',file);
  const {data}=await apiClient.post<{url:string}>('/files',form,{timeout:60_000});
  return data.url;
}
/** 업로드 파일 참조(/api/v1/files/{id})는 로그인 없이 열 수 없어서, 소유자용 임시 주소를 받아 열어요. 그 밖의 주소는 그대로 써요 */
export async function fileUrl(reference:string):Promise<string>{
  const id=/^(?:https?:\/\/[^/]+)?\/api\/v1\/files\/([0-9a-f-]{36})$/i.exec(reference)?.[1];
  if(!id)return reference;
  const {data}=await apiClient.get<{url:string}>(`/files/${id}/url`);
  return data.url;
}
