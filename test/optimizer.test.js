import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PARTS, PAIRS, pairKey, levelName, screenshotPreset, latestScreenshotPreset, blankInventory, defaultTwinbornOwned, emptyTargets, rarityLevelToField } from '../src/game-data.js';
import { optimizeCore, planChestAllocation, twinbornGoalFunding, minChestsPartToLegend0, resonanceLoadout } from '../src/optimizer.js';
import { VISION_CLASSIFICATION_STAGES, calibratedTemplateConfidence, detectedLevel, hasTwinbornMarker, parsedResultsToInventory, resolveVisionAssetUrl } from '../src/vision.js';
import { alignmentTransform } from '../src/opencv.js';

test('catalogued screenshot preset baseline resonance is stable',()=>{
  const result=optimizeCore(0,18,screenshotPreset(),emptyTargets(),true);
  assert.equal(result.e,10500);
  assert.equal(result.s,18);
});

test('resonance loadout accounts for every selected slot and energy point',()=>{
  const result=optimizeCore(0,18,screenshotPreset(),emptyTargets(),true);
  const loadout=resonanceLoadout(result.alloc);
  assert.equal(loadout.reduce((sum,row)=>sum+row.count,0),result.s);
  assert.equal(loadout.reduce((sum,row)=>sum+row.subtotal,0),result.e);
  assert.deepEqual(loadout.map(({level,count})=>[level,count]),[
    ['R4',6],['R3',6],['R0',1],['Y3',3],['Y2',2],
  ]);
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

test('parsed screenshot results aggregate across multiple screenshots',()=>{
  const derived=parsedResultsToInventory([
    {cards:[
      {kind:'part',tech:'Rocket',rarity:'Epic',level:0},
      {kind:'twinborn',pairKey:'Drone|Forcefield'},
    ]},
    {cards:[
      {kind:'part',tech:'Rocket',rarity:'Epic',level:0},
      {kind:'part',tech:'Drill',rarity:'Legend',level:4},
    ]},
  ],blankInventory,rarityLevelToField);

  assert.equal(derived.inventory.Rocket.Y0,2);
  assert.equal(derived.inventory.Drill.R4,1);
  assert.equal(derived.inventory.Drone.R0,0);
  assert.equal(derived.twinbornDetected['Drone|Forcefield'],true);
});

test('Twinborn type requires the distinct upper-left marker',()=>{
  assert.equal(hasTwinbornMarker({name:'Twinborn',confidence:.40}),true);
  assert.equal(hasTwinbornMarker({name:'Part',confidence:.80}),false);
  assert.equal(hasTwinbornMarker({name:'Twinborn',confidence:.02}),false);
});

test('a blank bottom badge is level 0',()=>{
  assert.equal(detectedLevel(''),0);
  assert.equal(detectedLevel(null),0);
  assert.equal(detectedLevel('4'),4);
  assert.equal(detectedLevel('0','1',.17),1);
  assert.equal(detectedLevel('0','1',.35),0);
});

test('purple cards use the user-facing Excellent rarity name',()=>{
  assert.equal(levelName('P2'),'Excellent 2');
  assert.equal(levelName('Rainbow'),'Eternal');
});

test('template confidence rewards a strong absolute image match',()=>{
  assert.equal(calibratedTemplateConfidence(0,1200,5000),1);
  assert.ok(calibratedTemplateConfidence(900,1200,5000)>.80);
  assert.ok(calibratedTemplateConfidence(4700,5000,5000)<.15);
});

test('vision asset paths follow the manifest that was successfully loaded',()=>{
  assert.equal(
    resolveVisionAssetUrl('./vision/tech/Drone_reference.png','https://example.test/TechBoxOptimizer/vision/'),
    'https://example.test/TechBoxOptimizer/vision/tech/Drone_reference.png',
  );
  assert.equal(
    resolveVisionAssetUrl('./vision/tech/Drone_reference.png','https://example.test/TechBoxOptimizer/public/vision/'),
    'https://example.test/TechBoxOptimizer/public/vision/tech/Drone_reference.png',
  );
});

test('vision hierarchy detects Twinborn before final rarity',()=>{
  assert.deepEqual(VISION_CLASSIFICATION_STAGES,['presence','twinborn','identity','level','rarity']);
});

test('OpenCV card alignment centers and scales a detected hex body',()=>{
  const transform=alignmentTransform({x:14,y:8,width:92,height:101},100,103);
  assert.ok(transform.scale>0);
  assert.ok(transform.confidence>.75);
  assert.ok(Number.isFinite(transform.tx));
  assert.ok(Number.isFinite(transform.ty));
});

test('clean image references are included in every tech and Twinborn template class',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../public/vision/manifest.json',import.meta.url),'utf8'));
  for(const tech of PARTS){
    assert.ok(manifest.tech[tech].some(path=>path.includes('_reference.png')),`${tech} badge reference missing`);
    assert.ok(manifest.art[tech].some(path=>path.includes('_reference.png')),`${tech} art reference missing`);
  }
  for(const pair of PAIRS){
    const key=pairKey(pair);
    assert.ok(manifest.twinborn[key].some(path=>path.includes('_reference.png')),`${key} Twinborn reference missing`);
  }
  const references=[
    ...Object.values(manifest.tech).flat(),
    ...Object.values(manifest.art).flat(),
    ...Object.values(manifest.twinborn).flat(),
    ...Object.values(manifest.markers).flat(),
    ...Object.values(manifest.levels).flatMap(levels=>Object.values(levels).flat()),
  ].filter(path=>path.includes('_reference'));
  assert.equal(references.length,60);
  for(const path of references)assert.ok(existsSync(new URL(`../public/${path.replace('./','')}`,import.meta.url)),`${path} missing`);
});

test('latest supplied screenshot list is captured as a separate preset',()=>{
  const inv=latestScreenshotPreset();
  assert.equal(inv.Drone.R4,1);
  assert.equal(inv.Drone.R0,2);
  assert.equal(inv.Rocket.R4,1);
  assert.equal(inv.Forcefield.R4,1);
  assert.equal(inv.Shield.R4,1);
  assert.equal(inv.Brick.R3,1);
  assert.equal(inv.Molotov.Y2,1);
  assert.equal(inv.Drill.Y3,1);
  assert.equal(inv.Laser.Y0,1);
  assert.equal(inv.Shield.P1,1);
  assert.equal(inv.Forcefield.P0,0);
});
