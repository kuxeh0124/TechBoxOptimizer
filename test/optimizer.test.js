import test from 'node:test';
import assert from 'node:assert/strict';
import { screenshotPreset, blankInventory, defaultTwinbornOwned, emptyTargets } from '../src/game-data.js';
import { optimizeCore, planChestAllocation, twinbornGoalFunding, minChestsPartToLegend0 } from '../src/optimizer.js';

test('catalogued screenshot preset baseline resonance is stable',()=>{
  const result=optimizeCore(0,18,screenshotPreset(),emptyTargets(),true);
  assert.equal(result.e,10500);
  assert.equal(result.s,18);
});

test('all supplied Epic choice chests are allocated',()=>{
  const plan=planChestAllocation(12,18,screenshotPreset(),emptyTargets(),'AUTO','BAL',0,defaultTwinbornOwned());
  const total=Object.values(plan.total).reduce((a,b)=>a+b,0);
  assert.equal(total,12);
});

test('owned Drone Twinborn roadmap uses the known screenshot inventory',()=>{
  const plan=twinbornGoalFunding(screenshotPreset(),['Drone','Forcefield'],defaultTwinbornOwned());
  assert.equal(plan.goal,'Eternal');
  assert.equal(plan.needs.Drone,0);
  assert.equal(plan.needs.Forcefield,10);
  assert.equal(plan.total,10);
});

test('missing Twinborn switches goal to Legend pair first',()=>{
  const owned=defaultTwinbornOwned();owned['Drone|Forcefield']=false;
  const plan=twinbornGoalFunding(screenshotPreset(),['Drone','Forcefield'],owned);
  assert.equal(plan.goal,'Legend');
});

test('Legend0 requires sixteen Epic0-equivalent units from scratch',()=>{
  assert.equal(minChestsPartToLegend0(blankInventory().Rocket),16);
});
