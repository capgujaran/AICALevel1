// Reveal only answers that have already passed the gateway and citation checks.
export function followNarrative(log,target,update){
  if(!log||!target){update();return;}
  if(!log.clientHeight){update();return;}
  const viewport=log.getBoundingClientRect();
  const position=()=>{
    const node=target.lastChild;
    if(node){const range=target.ownerDocument.createRange();range.selectNodeContents(node);range.collapse(false);const rect=range.getBoundingClientRect();if(rect.height)return rect;}
    const top=target.getBoundingClientRect().top;return {top,bottom:top+20};
  };
  if(!target.textContent){
    const start=target.getBoundingClientRect().top;
    if(start<viewport.top||start>viewport.bottom-24)log.scrollTop+=start-viewport.top-16;
  }
  const previous=position(),follow=previous.bottom>=viewport.top&&previous.top<=viewport.bottom;
  update();
  // Follow the line being revealed, leaving source cards below it. Reading older
  // messages pauses following until the reader returns to the active line.
  if(follow){const overflow=position().bottom-(viewport.bottom-16);if(overflow>0)log.scrollTop+=overflow;}
}

export function revealAnswer(text,{signal,onUpdate,reducedMotion=false,schedule=setTimeout,cancel=clearTimeout}={}){
  return new Promise((resolve,reject)=>{
    let timer,position=0;
    const pieces=text.match(/\s*\S+\s*/g)??[];
    const cleanup=()=>{cancel(timer);signal?.removeEventListener('abort',abort);};
    const abort=()=>{cleanup();reject(new DOMException('Answer stopped.','AbortError'));};
    const advance=()=>{
      if(signal?.aborted){abort();return;}
      position++;
      const visible=pieces.slice(0,position).join('');
      onUpdate(visible);
      if(position>=pieces.length){cleanup();resolve();return;}
      // Brief pauses at punctuation make the answer read like narration.
      const last=pieces[position-1].trim();
      const delay=/[.!?](?:\s*\[S\d+\])?$/.test(last)?170:/[,;:]$/.test(last)?85:32;
      timer=schedule(advance,delay);
    };
    if(signal?.aborted){abort();return;}
    if(reducedMotion||!pieces.length){onUpdate(text);resolve();return;}
    signal?.addEventListener('abort',abort,{once:true});
    advance();
  });
}
