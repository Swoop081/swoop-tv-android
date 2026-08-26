import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app/src/main/assets/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function card(item,poster=false,opts={}){');
const end = source.indexOf('\nfunction profileAvatarHtml(', start);
if (start < 0 || end < 0) throw new Error('Unable to locate card() in app.js');
const cardSource = source.slice(start, end);

const prelude = `
const NATIVE_ANDROID=true;
const visualItem=x=>x;
const hash=s=>1;
const displayRating=x=>'';
const tenPointRating=x=>'';
const displayImdbRating=x=>'';
const cleanDisplayTitle=x=>x?.name||'';
const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const isInMyList=x=>false;
const isLiveFavourite=x=>false;
const qualityLabel=x=>'';
const isWatched=x=>false;
`;

const factory = new Function(`${prelude}\n${cardSource}\nreturn card;`);
const card = factory();
const movie={id:'movie:1',kind:'movie',name:'Runtime Smoke Movie',logo:'poster.jpg'};
const ranked=card(movie,true,{rank:1});
const plain=card(movie,true,{});
if (!ranked.includes('rank-badge')) throw new Error('Ranked card did not render rank badge');
if (!plain.includes('data-detail="movie:1"')) throw new Error('Unranked card did not render normally');
console.log('card runtime smoke passed');
