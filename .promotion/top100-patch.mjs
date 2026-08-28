import fs from 'node:fs';

const path='.promotion/promote-pending.mjs';
let text=fs.readFileSync(path,'utf8');
const old=`  "const first=makeProfile({id:'profile-main',name:'Swoop TV',avatar:'lion',myList:[...(state.myList||[])],continueWatching:[...(state.continueWatching||[])],watchHistory:[...(state.watchHistory||[])],recentLive:[...(state.recentLive||[])],liveFavourites:[...(state.liveFavourites||[])],profileSettings:profileSettingsSnapshot()});",`;
const next=`  "const first=makeProfile({id:'profile-main',name:'Swoop TV',avatar:'lion',myList:state.myList,continueWatching:state.continueWatching,watchHistory:state.watchHistory,recentLive:state.recentLive,liveFavourites:state.liveFavourites,profileSettings:profileSettingsSnapshot()});",`;
if(!text.includes(old))throw new Error('v0.8.44 first-profile promotion anchor was not found');
text=text.replace(old,next);
fs.writeFileSync(path,text);
console.log('Adjusted v0.8.44 first-profile promotion anchor for current source.');
