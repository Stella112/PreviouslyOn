window.playEpisode=async function(stage,episode,signal){
 const wait=ms=>new Promise(resolve=>{const timer=setTimeout(resolve,ms);signal.addEventListener('abort',()=>{clearTimeout(timer);resolve()},{once:true})});
 const card=async(text,ms)=>{stage.replaceChildren();const h=document.createElement('h2');h.textContent=text;stage.append(h);await wait(ms)};
 await card(episode.title,3000);if(signal.aborted)return;
 for(const m of episode.moments){
  if(signal.aborted)return;stage.replaceChildren();const video=document.createElement('video');video.src=m.localPath;video.playsInline=true;const caption=document.createElement('p');caption.textContent=m.caption;stage.append(video,caption);
  await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;video.pause();resolve()};const timer=setTimeout(finish,Math.max(1000,(m.outPoint-m.inPoint+3)*1000));signal.addEventListener('abort',()=>{clearTimeout(timer);finish()},{once:true});video.onerror=()=>{clearTimeout(timer);finish()};video.onloadedmetadata=()=>{video.currentTime=m.inPoint;video.play().catch(finish)};video.ontimeupdate=()=>{if(video.currentTime>=m.outPoint){clearTimeout(timer);finish()}};});
 }
 if(signal.aborted)return;const credits=episode.moments.flatMap(m=>m.credit?['@'+m.credit.userName]:[]);await card(credits.length?'Starring chat: '+credits.join(', '):'Starring chat',4000);if(signal.aborted)return;await card(episode.teaser||'Thanks for watching',3000);
};
