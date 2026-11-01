window.playEpisode=async function(stage,episode,signal){
 const wait=ms=>new Promise(resolve=>{const timer=setTimeout(resolve,ms);signal.addEventListener('abort',()=>{clearTimeout(timer);resolve()},{once:true})});
 const videos=episode.moments.map(m=>{const v=document.createElement('video');v.preload='auto';v.src=m.localPath;v.playsInline=true;v.load();return v});
 const card=async(text,ms)=>{stage.replaceChildren();const h=document.createElement('h2');h.textContent=text;h.className='show-card';stage.append(h);await wait(ms)};
 await card(episode.title,3000);if(signal.aborted)return;
 for(let i=0;i<episode.moments.length;i++){
  const m=episode.moments[i];if(signal.aborted)return;stage.replaceChildren();const video=videos[i];const caption=document.createElement('p');caption.textContent=m.caption;if(m.credit){const credit=document.createElement('small');credit.textContent=({called_it:'called it',nominated:'nominated by',picked:'picked by'}[m.credit.kind]||'')+': @'+m.credit.userName;caption.append(credit)}stage.append(video,caption);
  await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;video.pause();resolve()};const timer=setTimeout(finish,Math.max(1000,(m.outPoint-m.inPoint+3)*1000));signal.addEventListener('abort',()=>{clearTimeout(timer);finish()},{once:true});video.onerror=()=>{clearTimeout(timer);finish()};const start=()=>{video.currentTime=m.inPoint;video.play().catch(finish)};if(video.readyState>=1)start();else video.onloadedmetadata=start;video.ontimeupdate=()=>{if(video.currentTime>=m.outPoint){clearTimeout(timer);finish()}};});
 }
 if(signal.aborted)return;const credits=episode.moments.flatMap(m=>m.credit?['@'+m.credit.userName]:[]);await card(credits.length?'Starring chat: '+credits.join(', '):'Starring chat',4000);if(signal.aborted)return;await card(episode.teaser||'Thanks for watching',3000);
};
