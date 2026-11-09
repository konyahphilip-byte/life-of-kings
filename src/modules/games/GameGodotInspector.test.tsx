import {test,expect,beforeEach,afterEach,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import Inspector from './GameGodotInspector';
import {newProject} from '../../../shared/game-vault.mjs';
import {inspectGodotProject} from '../../../shared/game-godot-preflight.mjs';
import type {GodotPreflight} from '../../../shared/game-godot-preflight.mjs';
vi.mock('../../../shared/game-godot-preflight.mjs',async original=>{const actual=await original<typeof import('../../../shared/game-godot-preflight.mjs')>();return {...actual,inspectGodotProject:vi.fn(actual.inspectGodotProject)};});
const project=()=>({...newProject('PRIVATE TITLE'),files:[{path:'project.godot',content:'config_version=5\n[application]\nrun/main_scene="res://main.tscn"\n'},{path:'main.tscn',content:'[gd_scene format=3]\n[node name="Main" type="Node"]\n'}]});
beforeEach(()=>vi.stubGlobal('fetch',vi.fn(()=>{throw Error('Inspector must not send source');})));
afterEach(()=>{cleanup();vi.clearAllMocks();vi.unstubAllGlobals();});
test('does not inspect or send data automatically; reports supported checks without claiming engine execution',async()=>{
 const p=project(),before=JSON.stringify(p);render(<Inspector ownerId="a" project={p}/>);expect(inspectGodotProject).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Inspect Godot source'));await screen.findByText('Supported references checked');expect(screen.getByText(/not Godot execution/)).toBeTruthy();expect(screen.getByText(/No files were changed/)).toBeTruthy();expect(fetch).not.toHaveBeenCalled();expect(JSON.stringify(p)).toBe(before);expect(document.activeElement).toBe(screen.getByRole('heading',{name:'Supported references checked'}));
});
test('missing source and binary assets have beginner repair guidance and inspectable graph',async()=>{
 const p=project();p.files[1].content='[gd_scene format=3]\n[ext_resource type="Script" path="res://lost.gd" id="1"]\n[ext_resource type="Texture2D" path="res://photo.png" id="2"]\n[node name="Main" type="Node"]\n';
 render(<Inspector ownerId="a" project={p}/>);fireEvent.click(screen.getByText('Inspect Godot source'));await screen.findByText('Source repairs needed');expect(screen.getByText(/original source at the referenced path/)).toBeTruthy();expect(screen.getByText(/No binary asset was imported/)).toBeTruthy();fireEvent.click(screen.getByText(/Dependency graph/));expect(screen.getAllByText(/lost.gd/).length).toBeGreaterThan(0);expect(fetch).not.toHaveBeenCalled();
});
test('draft edits invalidate a previous report',async()=>{
 const p=project(),view=render(<Inspector ownerId="a" project={p}/>);fireEvent.click(screen.getByText('Inspect Godot source'));await screen.findByText('Supported references checked');view.rerender(<Inspector ownerId="a" project={{...p,files:[]}}/>);expect(screen.queryByText('Supported references checked')).toBeNull();expect(screen.getByText('Inspect Godot source')).toBeTruthy();
});
test('cancel ignores a late result and restores focus',async()=>{
 const p=project();let resolve:(v:GodotPreflight)=>void=()=>{};vi.mocked(inspectGodotProject).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));render(<Inspector ownerId="a" project={p}/>);fireEvent.click(screen.getByText('Inspect Godot source'));const cancel=screen.getByText('Cancel inspection');cancel.focus();fireEvent.click(cancel);resolve({schema:'ecogames-godot-preflight-v1',root:null,engineExecuted:false,coverage:'late',status:'static-checked',nodes:[],edges:[],issues:[]});await waitFor(()=>expect(screen.queryByText('Supported references checked')).toBeNull());expect(screen.getByText(/Inspection cancelled/)).toBeTruthy();expect(document.activeElement).toBe(screen.getByText('Inspect Godot source'));
});
test('account switching never shows an old owner report or late result',async()=>{
 let resolve:(v:GodotPreflight)=>void=()=>{};vi.mocked(inspectGodotProject).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const view=render(<Inspector ownerId="a" project={project()}/>);fireEvent.click(screen.getByText('Inspect Godot source'));view.rerender(<Inspector ownerId="b" project={project()}/>);resolve({schema:'ecogames-godot-preflight-v1',root:null,engineExecuted:false,coverage:'PRIVATE A',status:'needs-repair',nodes:[],edges:[],issues:[]});await waitFor(()=>expect(screen.queryByText('PRIVATE A')).toBeNull());expect(screen.queryByText('Source repairs needed')).toBeNull();expect(fetch).not.toHaveBeenCalled();
});
test('errors stay generic and never report a completed inspection',async()=>{
 vi.mocked(inspectGodotProject).mockRejectedValueOnce(Error('PRIVATE INTERNAL SOURCE'));render(<Inspector ownerId="a" project={project()}/>);fireEvent.click(screen.getByText('Inspect Godot source'));await screen.findByRole('alert');expect(screen.getByRole('alert').textContent).not.toContain('PRIVATE INTERNAL SOURCE');expect(screen.queryByText('Supported references checked')).toBeNull();
});
test('disabled or guest workspace cannot start an inspection',()=>{
 const view=render(<Inspector ownerId={null} project={project()}/>);expect(screen.getByText('Inspect Godot source').matches(':disabled')).toBe(true);view.rerender(<Inspector ownerId="a" project={project()} disabled/>);fireEvent.click(screen.getByText('Inspect Godot source'));expect(inspectGodotProject).not.toHaveBeenCalled();
});
