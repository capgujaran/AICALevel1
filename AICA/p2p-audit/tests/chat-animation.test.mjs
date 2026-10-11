import test from 'node:test';
import assert from 'node:assert/strict';
import {revealAnswer,followNarrative} from '../site/core/chat-animation.mjs';

function clock(){
  const queue=new Map();let id=0;
  return {queue,schedule(fn,delay){queue.set(++id,{fn,delay});return id;},cancel(id){queue.delete(id);},tick(){const [id,job]=queue.entries().next().value;queue.delete(id);job.fn();}};
}
test('Narration reveals words progressively and preserves text, citations and line breaks',async()=>{
  const time=clock(),updates=[],text='Brief answer.\n• Check evidence [S1].\n';
  const done=revealAnswer(text,{onUpdate:s=>updates.push(s),schedule:time.schedule,cancel:time.cancel});
  assert.equal(updates.length,1);assert.notEqual(updates[0],text);
  while(time.queue.size)time.tick();await done;
  assert.equal(updates.at(-1),text);
  for(const value of updates)assert.ok(text.startsWith(value));
  assert.ok(updates.some(s=>s.includes('[S1]')));
});
test('Stopping narration cancels pending output and rejects without completing it',async()=>{
  const time=clock(),controller=new AbortController(),updates=[];
  const done=revealAnswer('One two three four.',{signal:controller.signal,onUpdate:s=>updates.push(s),schedule:time.schedule,cancel:time.cancel});
  controller.abort();await assert.rejects(done,{name:'AbortError'});
  assert.equal(time.queue.size,0);assert.equal(updates.length,1);
});
test('Reduced motion provides the complete answer without timers',async()=>{
  const updates=[];
  await revealAnswer('Answer [S1]',{reducedMotion:true,onUpdate:s=>updates.push(s),schedule:()=>{throw new Error('No motion timer expected');}});
  assert.deepEqual(updates,['Answer [S1]']);
});

function scrollingFixture({start=20,caret=70,text='One '}={}){
  const log={clientHeight:100,scrollHeight:5000,scrollTop:0,getBoundingClientRect:()=>({top:0,bottom:100})};
  const node={};
  const target={textContent:text,lastChild:node,getBoundingClientRect:()=>({top:start-log.scrollTop}),ownerDocument:{createRange:()=>({selectNodeContents(){},collapse(){},getBoundingClientRect:()=>({top:caret-log.scrollTop,bottom:caret-log.scrollTop+20,height:20})})}};
  return {log,target,advance(){caret+=40;target.textContent+='next ';}};
}

test('Narration follows its visible line instead of the end of chat or source cards',()=>{
  const app=scrollingFixture();
  followNarrative(app.log,app.target,()=>app.advance());
  assert.equal(app.log.scrollTop,46);
  assert.ok(app.log.scrollTop<app.log.scrollHeight-app.log.clientHeight);
});

test('Reading older messages pauses following and returning to the line resumes it',()=>{
  const app=scrollingFixture();
  app.log.scrollTop=-200;
  followNarrative(app.log,app.target,()=>app.advance());
  assert.equal(app.log.scrollTop,-200);
  app.log.scrollTop=50;
  followNarrative(app.log,app.target,()=>app.advance());
  assert.equal(app.log.scrollTop,86);
});

test('New answers start in view before the first word is revealed',()=>{
  const app=scrollingFixture({start:800,caret:800,text:''});
  followNarrative(app.log,app.target,()=>{app.target.textContent='First ';});
  assert.equal(app.log.scrollTop,784);
  assert.equal(app.target.textContent,'First ');
});

test('A hidden chat continues its text update without moving the scroll position',()=>{
  const app=scrollingFixture();app.log.clientHeight=0;
  followNarrative(app.log,app.target,()=>app.advance());
  assert.equal(app.log.scrollTop,0);
  assert.equal(app.target.textContent,'One next ');
});
