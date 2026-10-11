export function createStopwatch(now=()=>performance.now()){
  let accumulated=0,started=null;
  return {
    get running(){return started!==null;},
    elapsed(){return accumulated+(started===null?0:Math.max(0,now()-started));},
    start(){if(started===null)started=now();},
    pause(){if(started!==null){accumulated+=Math.max(0,now()-started);started=null;}},
    reset(){accumulated=0;started=null;}
  };
}

export function formatElapsed(milliseconds){
  const seconds=Math.floor(milliseconds/1000);
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}

export function attachPresentationTimer(root){
  const clock=createStopwatch(),display=root.querySelector('[data-timer-display]'),toggle=root.querySelector('[data-timer-toggle]'),status=root.querySelector('[data-timer-status]');
  let interval;
  function render(){
    display.textContent=formatElapsed(clock.elapsed());
    toggle.textContent=clock.running?'Pause':clock.elapsed()?'Resume':'Start';
    toggle.setAttribute('aria-label',`${toggle.textContent} presentation timer`);
    status.textContent=clock.running?'Running':clock.elapsed()?'Paused':'Ready';
    root.dataset.running=String(clock.running);
  }
  toggle.addEventListener('click',()=>{
    if(clock.running){clock.pause();clearInterval(interval);}
    else{clock.start();interval=setInterval(render,200);}
    render();
  });
  root.querySelector('[data-timer-reset]').addEventListener('click',()=>{clearInterval(interval);clock.reset();render();});
  render();
}
