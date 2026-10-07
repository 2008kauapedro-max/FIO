export type QrFormat='png'|'svg'|'pdf';

function save(blob:Blob,name:string){
 const url=URL.createObjectURL(blob);
 const anchor=document.createElement('a');anchor.href=url;anchor.download=name;
 document.body.appendChild(anchor);anchor.click();anchor.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1200);
}
async function imageCanvas(svg:SVGSVGElement){
 const text='<?xml version="1.0" encoding="UTF-8"?>'+new XMLSerializer().serializeToString(svg);
 const url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml;charset=utf-8'}));
 try{
  const img=new Image();
  await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Falha ao carregar QR Code.'));img.src=url;});
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1000;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas indisponível.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,1000,1000);ctx.drawImage(img,0,0,1000,1000);
  return canvas;
 }finally{URL.revokeObjectURL(url);}
}
function imagePdf(image:Uint8Array<ArrayBuffer>):Blob{
 const enc=new TextEncoder();
 const data:Uint8Array<ArrayBuffer>[]=[];
 const offsets:number[]=[];
 let size=0;
 function add(v:string|Uint8Array<ArrayBuffer>){const bytes=typeof v==='string'?enc.encode(v):v;data.push(bytes);size+=bytes.byteLength;}
 function obj(id:number,content:()=>void){offsets[id]=size;add(id+' 0 obj\n');content();add('\nendobj\n');}
 add('%PDF-1.4\n');
 obj(1,()=>add('<< /Type /Catalog /Pages 2 0 R >>'));
 obj(2,()=>add('<< /Type /Pages /Count 1 /Kids [3 0 R] >>'));
 obj(3,()=>add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /QR 4 0 R >> >> /Contents 5 0 R >>'));
 obj(4,()=>{add('<< /Type /XObject /Subtype /Image /Width 1000 /Height 1000 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+image.length+' >>\nstream\n');add(image);add('\nendstream');});
 const cmd='q\n360 0 0 360 117.5 241 cm\n/QR Do\nQ\n';
 obj(5,()=>{add('<< /Length '+enc.encode(cmd).length+' >>\nstream\n');add(cmd);add('endstream');});
 const start=size;add('xref\n0 6\n0000000000 65535 f \n');
 for(let i=1;i<=5;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
 add('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF');
 return new Blob(data,{type:'application/pdf'});
}
export async function downloadQrCode(svg:SVGSVGElement,slug:string,format:QrFormat){
 const file=(slug||'fio')+'-qr-code.'+format;
 if(format==='svg'){
  save(new Blob(['<?xml version="1.0" encoding="UTF-8"?>'+new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'}),file);
  return;
 }
 const canvas=await imageCanvas(svg);
 if(format==='png'){
  const png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Falha ao criar PNG.')),'image/png'));
  save(png,file);return;
 }
 const base64=canvas.toDataURL('image/jpeg',.96).split(',')[1]??'';
 save(imagePdf(Uint8Array.from(atob(base64),c=>c.charCodeAt(0))),file);
}
