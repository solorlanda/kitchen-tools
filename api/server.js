import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { MongoClient } from 'mongodb';

const app = express();
const PORT = Number(process.env.PORT || 10000);
const URI = process.env.MONGODB_URI;
const ACCESS_CODE = process.env.TEAM_ACCESS_CODE;
const SESSION_SECRET = process.env.SESSION_SECRET;
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://kitchen-tools.onrender.com').split(',').map(s=>s.trim());
const kinds=['prep','opening','closing','shopping'];
if(!URI || !ACCESS_CODE || !SESSION_SECRET) throw Error('Missing required environment variables');
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({origin:(origin,cb)=>cb(null,!origin||ORIGINS.includes(origin))}));
app.use(express.json({limit:'200kb'}));
app.use('/api',rateLimit({windowMs:60*1000,limit:150,standardHeaders:'draft-7',legacyHeaders:false}));
const client=new MongoClient(URI,{serverSelectionTimeoutMS:15000,maxPoolSize:10});
const safeEq=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)};
const sign=payload=>{const b=Buffer.from(JSON.stringify(payload)).toString('base64url');return b+'.'+crypto.createHmac('sha256',SESSION_SECRET).update(b).digest('base64url')};
const verify=token=>{if(typeof token!=='string'||!token.includes('.'))return null;const [b,s]=token.split('.');const expected=crypto.createHmac('sha256',SESSION_SECRET).update(b).digest('base64url');if(!safeEq(s,expected))return null;try{const p=JSON.parse(Buffer.from(b,'base64url').toString());return p.exp>Date.now() && typeof p.name==='string'?p:null}catch{return null}};
const auth=(req,res,next)=>{const token=(req.headers.authorization||'').replace(/^Bearer /,'');const user=verify(token);if(!user)return res.status(401).json({error:'Please sign in again'});req.user=user;next()};
const initial=()=>({_id:'team',revision:0,date:new Date().toISOString().slice(0,10),prep:[],opening:[],closing:[],shopping:[]});
let store;
app.get('/api/health',(_req,res)=>res.json({ok:true,storage:'mongodb'}));
app.post('/api/login',rateLimit({windowMs:15*60*1000,limit:12,standardHeaders:'draft-7',legacyHeaders:false}), (req,res)=>{
 const {code,name}=req.body||{};
 if(!safeEq(String(code||''),ACCESS_CODE))return res.status(401).json({error:'Invalid team access code'});
 const clean=String(name||'').trim().slice(0,45);
 if(clean.length<2)return res.status(400).json({error:'Enter your name (at least 2 characters)'});
 res.json({token:sign({name:clean,exp:Date.now()+7*24*60*60*1000}),name:clean});
});
app.get('/api/state',auth,async(_req,res,next)=>{try{const d=await store.findOne({_id:'team'});res.json(d||initial())}catch(e){next(e)}});
app.post('/api/action',auth,async(req,res,next)=>{
 try{
  const {type,kind,id,item}=req.body||{};
  if(!kinds.includes(kind)||!['add','edit','toggle','delete','reset','replace'].includes(type))return res.status(400).json({error:'Invalid action'});
  if(type==='add'||type==='edit'){
   if(!item || typeof item.title!=='string' || !item.title.trim() || item.title.length>160)return res.status(400).json({error:'Item title is required'});
  }
  for(let attempt=0;attempt<12;attempt++){
   const d=await store.findOne({_id:'team'});
   if(!d)return res.status(503).json({error:'Store not initialized'});
   const list=[...d[kind]];
   if(type==='add'){
    if(list.length>=500)return res.status(400).json({error:'List is full'});
    const clean=cleanItem(item);list.unshift({...clean,id:crypto.randomUUID(),done:false,updatedBy:req.user.name});
   } else if(type==='edit'){
    const at=list.findIndex(x=>x.id===id);if(at<0)return res.status(404).json({error:'Item not found'});
    list[at]={...list[at],...cleanItem(item),id:list[at].id,updatedBy:req.user.name};
   } else if(type==='toggle'){
    const at=list.findIndex(x=>x.id===id);if(at<0)return res.status(404).json({error:'Item not found'});
    list[at]={...list[at],done:!list[at].done,updatedBy:req.user.name};
   } else if(type==='delete'){
    const at=list.findIndex(x=>x.id===id);if(at<0)return res.status(404).json({error:'Item not found'});
    list.splice(at,1);
   } else if(type==='reset'){
    for(let i=0;i<list.length;i++)list[i]={...list[i],done:false,updatedBy:req.user.name};
   } else if(type==='replace'){
    if(!Array.isArray(req.body.items)||req.body.items.length>500)return res.status(400).json({error:'Invalid list'});
    list.splice(0,list.length,...req.body.items.map(x=>({...cleanItem(x),id:crypto.randomUUID(),done:!!x.done,updatedBy:req.user.name})));
   }
   const result=await store.updateOne({_id:'team',revision:d.revision},{$set:{[kind]:list,updatedAt:new Date()},$inc:{revision:1}});
   if(result.modifiedCount){const nextDoc=await store.findOne({_id:'team'});return res.json(nextDoc)}
  }
  res.status(409).json({error:'Too many simultaneous changes; please retry'});
 }catch(e){next(e)}
});
function cleanItem(x){const fields=['title','station','quantity','priority','amount','unit','category','note'];const out={};for(const f of fields){if(x?.[f]!==undefined)out[f]=String(x[f]).slice(0,f==='title'?160:120)}return out}
app.use((err,req,res,next)=>{console.error('API failure',err.message);res.status(500).json({error:'Server error, please try again'})});
await client.connect();
store=client.db('kitchen_manager').collection('state');
await store.updateOne({_id:'team'},{$setOnInsert:{revision:0,date:new Date().toISOString().slice(0,10),prep:[],opening:[],closing:[],shopping:[]}},{upsert:true});
app.listen(PORT,'0.0.0.0',()=>console.log('Kitchen Manager API listening on '+PORT));
