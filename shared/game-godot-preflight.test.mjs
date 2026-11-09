// @vitest-environment node
import {test,expect} from 'vitest';
import {inspectGodotProject,summarizeGodotPreflight} from './game-godot-preflight.mjs';
import {fixtureProject} from '../scripts/test-game-project-export.mjs';
const project=(files)=>({...fixtureProject(),files});
const config='config_version=5\n[application]\nrun/main_scene="res://scenes/main.tscn"\n';
const scene='[gd_scene format=3]\n[node name="Main" type="Node3D"]\n';
const codes=r=>r.issues.map(x=>x.code);
test('requires exact root config and leaves every original byte unchanged',async()=>{
 const p=project([{path:'nested/project.godot',content:config}]),before=JSON.stringify(p);const r=await inspectGodotProject(p);
 expect(codes(r)).toContain('missing-project');expect(r.engineExecuted).toBe(false);expect(JSON.stringify(p)).toBe(before);
 const c=await inspectGodotProject(project([{path:'Project.godot',content:config}]));expect(codes(c)).toContain('missing-project');
});
test('recognizes real Godot4 scene script and resource dependencies transitively',async()=>{
 const p=fixtureProject();p.files[1].content+='material = ExtResource("2")\n';p.files[1].content=p.files[1].content.replace('[node','[ext_resource type="Material" path="../materials/blue.tres" id="2"]\n\n[node');
 p.files.push({path:'materials/blue.tres',content:'[gd_resource type="StandardMaterial3D" format=3]\n[resource]\nalbedo_color = Color(0.1, 0.2, 0.3, 1)\n'});
 const before=JSON.stringify(p),r=await inspectGodotProject(p);
 expect(r.root).toBe('project.godot');expect(r.issues.filter(x=>x.severity==='error')).toEqual([]);expect(r.edges.map(e=>[e.from,e.target,e.status])).toEqual(expect.arrayContaining([['project.godot','scenes/main.tscn','present'],['scenes/main.tscn','scripts/main.gd','present'],['scenes/main.tscn','materials/blue.tres','present']]));
 expect(r.nodes).toHaveLength(6);expect(r.status).toBe('static-checked');expect(r.engineExecuted).toBe(false);expect(JSON.stringify(p)).toBe(before);
});
test('collects literal script references but ignores comments and string lookalikes',async()=>{
 const script=['extends "res://scripts/base.gd"','const Level = preload("res://scenes/main.tscn")','var material = load("res://materials/blue.tres")','# load("res://NEVER.gd")','var text = """preload("res://ALSO_NEVER.gd")"""', "var quoted = 'load(\"res://NOT_A_CALL.gd\")'"].join('\n');
 const p=project([{path:'project.godot',content:config},{path:'scenes/main.tscn',content:scene},{path:'scripts/main.gd',content:script},{path:'scripts/base.gd',content:'extends Node3D\n'},{path:'materials/blue.tres',content:'[gd_resource type="Resource" format=3]\n[resource]\n'}]);
 const r=await inspectGodotProject(p);expect(r.edges.map(x=>x.target)).not.toEqual(expect.arrayContaining(['NEVER.gd','ALSO_NEVER.gd','NOT_A_CALL.gd']));
 expect(r.edges.filter(x=>x.from==='scripts/main.gd').map(x=>x.kind)).toEqual(['extends','preload','load']);expect(r.status).toBe('static-checked');
});
test('reports missing source, missing binary assets and UID-only dependencies honestly',async()=>{
 const p=project([{path:'project.godot',content:config},{path:'scenes/main.tscn',content:'[gd_scene format=3]\n[ext_resource type="Script" path="res://lost.gd" id="1"]\n[ext_resource type="Texture2D" path="res://assets/photo.png" id="2"]\n[node name="Main" type="Node2D"]\nscript = ExtResource("1")\ntexture = ExtResource("2")\n'},{path:'uid.gd',content:'extends Node\nvar level = preload("uid://abc123")\n'}]);
 const r=await inspectGodotProject(p);expect(codes(r)).toEqual(expect.arrayContaining(['missing-source','missing-asset','uid-unresolved']));expect(r.status).toBe('needs-repair');expect(r.edges.find(e=>e.target==='assets/photo.png').status).toBe('missing-asset');
});
test.each([
 ['project.godot','config_version=4\n','unsupported-format'],
 ['scenes/main.tscn','[gd_scene format=2]\n[node name="A" type="Node"]\n','unsupported-format'],
 ['scenes/main.tscn','[gd_scene format=3\n[node name="A" type="Node"]\n','malformed-text'],
 ['scenes/main.tscn','[gd_scene format=3]\n[node name="A" type="Node"]\nvalue = "unfinished\n','malformed-text'],
 ['scenes/main.tscn','[gd_scene format=3]\n[node name="A" type="Node"]\nvalue = Vector3(1,2]\n','malformed-text'],
 ['scenes/main.tscn','hello\n','invalid-resource'],
 ['materials/a.tres','[gd_resource type="Resource" format=3]\n','invalid-resource'],
 ['scenes/main.tscn','[gd_scene format=3]\n[node name="A" parent="." type="Node"]\n','invalid-resource']
])('detects malformed or unsupported %s without an engine',async(path,content,code)=>{
 const files=[{path:'project.godot',content:config},{path:'scenes/main.tscn',content:scene}].filter(f=>f.path!==path);files.push({path,content});const r=await inspectGodotProject(project(files));expect(codes(r)).toContain(code);expect(r.status).not.toBe('static-checked');
});
test('validates resource declarations, duplicate IDs, dangling IDs and kind mismatches',async()=>{
 const r=await inspectGodotProject(project([{path:'project.godot',content:config},{path:'scenes/main.tscn',content:'[gd_scene format=3]\n[ext_resource type="Script" path="res://scenes/main.tscn" id="1"]\n[ext_resource type="Script" path="res://missing.gd" id="1"]\n[sub_resource type="Resource" id="Local"]\n[node name="Main" type="Node"]\nscript = ExtResource("unknown")\nvalue = SubResource("lost")\n'}]));
 expect(codes(r)).toEqual(expect.arrayContaining(['duplicate-resource-id','undefined-resource-id','resource-kind']));
});
test('handles local subresource references and multiline properties without fake missing files',async()=>{
 const r=await inspectGodotProject(project([{path:'project.godot',content:config},{path:'scenes/main.tscn',content:'[gd_scene format=3]\n[sub_resource type="BoxMesh" id="Mesh"]\nsize = Vector3(\n1, 2, 3\n)\n[node name="Main" type="MeshInstance3D"]\nmesh = SubResource("Mesh")\n'}]));expect(r.issues.filter(x=>x.severity==='error')).toEqual([]);expect(codes(r)).not.toContain('undefined-resource-id');
});
test.each(['res://../escape.gd','/etc/private.gd','https://example.org/a.gd','user://private.gd','res://a/%2e%2e/b.gd'])('never resolves unsafe/external dependency %s',async(target)=>{
 const r=await inspectGodotProject(project([{path:'project.godot',content:config},{path:'scenes/main.tscn',content:scene},{path:'main.gd',content:'extends Node\nvar x = load('+JSON.stringify(target)+')\n'}]));expect(codes(r)).toContain('unsafe-reference');expect(r.edges.find(e=>e.from==='main.gd').status).toBe('invalid');
});
test('reports case mismatch, conflicting UID declarations and duplicate keys',async()=>{
 const r=await inspectGodotProject(project([{path:'project.godot',content:config+'run/main_scene="res://Scenes/main.tscn"\n'},{path:'scenes/main.tscn',content:'[gd_scene format=3]\n[ext_resource type="Script" uid="uid://same" path="res://a.gd" id="1"]\n[ext_resource type="Script" uid="uid://same" path="res://b.gd" id="2"]\n[node name="Main" type="Node"]\n'},{path:'a.gd',content:'extends Node\n'},{path:'b.gd',content:'extends Node\n'}]));
 expect(codes(r)).toEqual(expect.arrayContaining(['duplicate-setting','case-conflict','uid-conflict']));
});
test('flags plugins, tool scripts, dynamic calls and unsupported relative script paths',async()=>{
 const r=await inspectGodotProject(project([{path:'project.godot',content:config+'[editor_plugins]\nenabled=PackedStringArray("res://addons/editor/plugin.cfg")\n'},{path:'scenes/main.tscn',content:scene},{path:'main.gd',content:'@tool\nextends Node\nvar a=load(path)\nvar b=preload("res://" + name)\nvar c=load("nearby.tres")\n'}]));
 expect(codes(r)).toEqual(expect.arrayContaining(['plugin-required','tool-script','dynamic-reference','relative-script-reference']));expect(r.status).toBe('limited');expect(r.engineExecuted).toBe(false);
});
test('unknown GDScript syntax is never certified as compiled and cyclic dependencies remain visible',async()=>{
 const r=await inspectGodotProject(project([{path:'project.godot',content:config},{path:'scenes/main.tscn',content:scene},{path:'a.gd',content:'extends "res://b.gd"\nthis is not compiled\n'},{path:'b.gd',content:'extends "res://a.gd"\n'}]));
 expect(codes(r)).toContain('dependency-cycle');expect(r.coverage).toContain('not a GDScript compiler');expect(r.engineExecuted).toBe(false);
});
test('cancels before and between files, leaving the input unchanged',async()=>{
 const a=new AbortController();a.abort();await expect(inspectGodotProject(fixtureProject(),{signal:a.signal})).rejects.toThrow(/cancel/i);
 const b=new AbortController(),p=fixtureProject(),before=JSON.stringify(p);let steps=0;await expect(inspectGodotProject(p,{signal:b.signal,yieldControl:async()=>{steps++;b.abort();}})).rejects.toThrow(/cancel/i);expect(steps).toBe(1);expect(JSON.stringify(p)).toBe(before);
});
test('caps reference work and returns a limitation rather than a false all-clear',async()=>{
 const p=project([{path:'project.godot',content:config},{path:'scenes/main.tscn',content:scene},{path:'many.gd',content:Array.from({length:250},(_,i)=>'var x'+i+'=load("res://file'+i+'.gd")').join('\n')}]);const r=await inspectGodotProject(p);expect(r.edges.length).toBeLessThanOrEqual(200);expect(codes(r)).toContain('inspection-limit');expect(r.status).not.toBe('static-checked');
});
test('future AI explanation summary contains only trusted codes and counts, never source paths or private text',async()=>{
 const p=project([{path:'project.godot',content:config},{path:'scenes/main.tscn',content:scene},{path:'PRIVATE_NAME.gd',content:'extends Node\n# PRIVATE SOURCE NEEDLE\nvar a=load("res://PRIVATE_TARGET.gd")\n'}]);const r=await inspectGodotProject(p);const summary=summarizeGodotPreflight(r);expect(summary.schema).toBe('godot-preflight-summary-v1');expect(summary.issueCodes).toContain('missing-source');expect(JSON.stringify(summary)).not.toMatch(/PRIVATE|project.godot|scenes\/|title|owner|content/);expect(summary.engineExecuted).toBe(false);
});

test('resource-ID words in string properties remain plain text',async()=>{
 const r=await inspectGodotProject(project([{path:'project.godot',content:config},{path:'scenes/main.tscn',content:scene+'description = "ExtResource"\nother = "SubResource"\n'}]));expect(r.issues.filter(x=>x.severity==='error')).toEqual([]);
});
test('reports CSharp and native-extension requirements without loading them',async()=>{
 const r=await inspectGodotProject(project([{path:'project.godot',content:config+'config/features=PackedStringArray("4.7", "C#")\n'},{path:'scenes/main.tscn',content:scene},{path:'native.gd',content:'extends Node\nvar extension = load("res://addons/example.gdextension")\n'}]));expect(codes(r)).toEqual(expect.arrayContaining(['unsupported-language','native-extension']));expect(r.engineExecuted).toBe(false);
});

test('review threaded resource requests are inspected or explicitly limited',async()=>{
 const p=fixtureProject();p.files[2].content+='var ticket=ResourceLoader.load_threaded_request("res://missing.tscn")\n';const r=await inspectGodotProject(p);expect(codes(r)).toContain('missing-source');expect(r.edges.some(e=>e.target==='missing.tscn')).toBe(true);
});
test('review malformed general settings cannot receive an all clear',async()=>{
 const p=fixtureProject();p.files[0].content+='[rendering]\ninvalid=definitely not a Godot variant\n';const r=await inspectGodotProject(p);expect(r.status).not.toBe('static-checked');expect(codes(r)).toContain('unsupported-syntax');
});
test('review duplicate file header UIDs conflict even without external declarations',async()=>{
 const p=fixtureProject();p.files[1].content=p.files[1].content.replace('format=3','format=3 uid="uid://same"');p.files.push({path:'other.tres',content:'[gd_resource type="Resource" format=3 uid="uid://same"]\n[resource]\n'});const r=await inspectGodotProject(p);expect(codes(r)).toContain('uid-conflict');
});

test.each([
 ['project.godot','config_version="5"\n','unsupported-format'],
 ['main.tscn','[gd_scene format="3"]\n[node name="Main" type="Node"]\n','unsupported-format'],
 ['bad.tres','[gd_resource type=123 format=3]\n[resource]\n','invalid-resource'],
 ['main.tscn','[gd_scene format=3]\n[ext_resource type=123 path="res://x.gd" id=123]\n[node name="Main" type="Node"]\n','invalid-resource']
])('strict typed headers/settings reject %s',async(path,content,code)=>{
 const p=fixtureProject();p.files=p.files.filter(f=>f.path!==path);p.files.push({path,content});const r=await inspectGodotProject(p);expect(codes(r)).toContain(code);
});

test.each(['uid=123','uid="not-a-godot-uid"'])('rejects malformed resource UID metadata %s',async(uid)=>{
 const p=fixtureProject();p.files[1].content=p.files[1].content.replace('format=3','format=3 '+uid);const r=await inspectGodotProject(p);expect(codes(r)).toContain('invalid-resource');
});
