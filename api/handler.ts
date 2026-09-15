import type { IncomingMessage,ServerResponse } from 'node:http';
import { createApp } from '../server/app.js';

const app=createApp();

export default function handler(req:IncomingMessage,res:ServerResponse){
 const url=new URL(req.url??'/','http://localhost');
 const route=url.searchParams.get('route')??'';
 url.searchParams.delete('route');
 const query=url.searchParams.toString();
 req.url=`/api/${route}${query?`?${query}`:''}`;
 return app(req,res);
}
