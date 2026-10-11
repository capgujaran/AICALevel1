import test from 'node:test';
import assert from 'node:assert/strict';
import {createStopwatch,formatElapsed} from '../site/core/presentation-timer.mjs';

test('Timer starts only on Start and uses elapsed time rather than counting callbacks',()=>{
  let now=100;const clock=createStopwatch(()=>now);
  now=5000;assert.equal(clock.elapsed(),0);
  clock.start();now=71000;assert.equal(formatElapsed(clock.elapsed()),'01:06');
  clock.start();assert.equal(clock.elapsed(),66000,'Repeated Start cannot reset the clock');
});
test('Pause excludes paused time, Resume continues, and Reset stops at zero',()=>{
  let now=0;const clock=createStopwatch(()=>now);
  clock.start();now=1500;clock.pause();now=10000;
  assert.equal(clock.elapsed(),1500);assert.equal(clock.running,false);
  clock.start();now=12500;assert.equal(clock.elapsed(),4000);
  clock.reset();now=50000;assert.equal(clock.elapsed(),0);assert.equal(clock.running,false);
});
test('Time formatting handles minute boundaries and presentations longer than an hour',()=>{
  assert.equal(formatElapsed(999),'00:00');assert.equal(formatElapsed(60000),'01:00');assert.equal(formatElapsed(3601000),'60:01');
});
