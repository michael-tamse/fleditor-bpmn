#!/usr/bin/env ts-node
/*
 * ts-callgraph.ts — Function-level call graph + module dependency graph for TS/JS projects
 *
 * Outputs:
 *  - <outDir>/graph.json         — nodes + edges with rich metadata (params/returns/export flags)
 *  - <outDir>/calls.mmd          — Mermaid flowchart of function-level call graph (grouped by file)
 *  - <outDir>/modules.mmd        — Mermaid diagram of file/module-level imports
 *  - <outDir>/calls.dot          — Graphviz DOT of the function-level call graph (optional)
 *
 * Usage examples:
 *  npx ts-node tools/ts-callgraph.ts \
 *     --project tsconfig.json \
 *     --include "src/**\/*.ts" --include "src/**\/*.tsx" \
 *     --exclude "**\/*.spec.ts" --exclude "**\/*.test.ts" --exclude "**\/*.d.ts" \
 *     --out callgraph --no-dot
 *
 * Notes:
 *  - Works without React; plain TS/HTML projects are fine.
 *  - Best-effort resolution of callees using the TypeScript type checker via ts-morph (incl. aliases/imports).
 *  - Dynamic calls (e.g., (x as any)(), DI containers, string-based lookups) are not resolvable statically.
 */

import path from 'path';
import fs from 'fs';
import { Project, SyntaxKind, Node, SourceFile, FunctionDeclaration, MethodDeclaration, ArrowFunction, FunctionExpression, VariableDeclaration, PropertyAssignment, ClassDeclaration, InterfaceDeclaration, Symbol as MorphSymbol } from 'ts-morph';
import minimist from 'minimist';

// ------------------------------ CLI ---------------------------------

const args = minimist(process.argv.slice(2), {
  string: ['project', 'out', 'cwd'],
  boolean: ['dot', 'external'],
  alias: { p: 'project', o: 'out' },
  default: {
    project: 'tsconfig.json',
    out: 'callgraph',
    dot: true,
    external: false
  }
});

const includeGlobs: string[] = ([] as string[]).concat(args.include || []);
const excludeGlobs: string[] = ([] as string[]).concat(args.exclude || []);

const CWD = path.resolve(process.cwd(), args.cwd || '.');
const OUT_DIR = path.resolve(CWD, args.out);

// Simple glob test using minimatch-like regex conversion (avoid extra deps);
// for large repos you may swap with 'fast-glob' for perf.
function globToRegExp(glob: string): RegExp {
  const esc = (s: string) => s.replace(/[.+^${}()|\[\]\\]/g, '\\$&');
  let out = '';
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        out += '.*';
        i += 2;
      } else {
        out += '[^/]*';
        i++;
      }
      continue;
    }
    if (ch === '?') { out += '[^/]'; i++; continue; }
    if (ch === '/') { out += '/'; i++; continue; }
    out += esc(ch);
    i++;
  }
  return new RegExp('^' + out + '$');
}

const includeRegs = includeGlobs.map(globToRegExp);
const excludeRegs = excludeGlobs.map(globToRegExp);

function matchesAny(regs: RegExp[], rel: string): boolean {
  if (regs.length === 0) return true; // no include => include all
  return regs.some(r => r.test(rel));
}
function matchesNone(regs: RegExp[], rel: string): boolean {
  return regs.every(r => !r.test(rel));
}

// ------------------------------ Setup Project -----------------------

const tsconfigPath = path.resolve(CWD, args.project);
if (!fs.existsSync(tsconfigPath)) {
  console.error(`Cannot find tsconfig at ${tsconfigPath}`);
  process.exit(1);
}

const project = new Project({ tsConfigFilePath: tsconfigPath, skipAddingFilesFromTsConfig: false });

let allFiles = project.getSourceFiles();

// Filter by include/exclude
const files = allFiles.filter(sf => {
  const rel = path.posix.normalize(path.relative(CWD, sf.getFilePath()).split(path.sep).join('/'));
  if (excludeRegs.length && !matchesNone(excludeRegs, rel)) return false;
  if (!matchesAny(includeRegs, rel)) return includeRegs.length === 0; // include all if no include patterns
  return true;
});

if (files.length === 0) {
  console.error('No source files after include/exclude filtering. Check your patterns.');
  process.exit(2);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// ------------------------------ Types --------------------------------

type FnLike = FunctionDeclaration | MethodDeclaration | ArrowFunction | FunctionExpression;

type NodeInfo = {
  id: string;
  name: string;
  file: string; // absolute
  fileRel: string; // relative to cwd
  line: number;
  kind: string;
  exported: boolean;
  external: boolean;
  params: { name: string; type: string }[];
  returns: string;
};

type Edge = { from: string; to: string; count: number };

// ------------------------------ Helpers ------------------------------

function rel(p: string): string {
  return path.posix.normalize(path.relative(CWD, p).split(path.sep).join('/'));
}

function shortFileLabel(relPath: string): string {
  // collapse long paths for Mermaid readability
  return relPath.length > 64 ? '…' + relPath.slice(-64) : relPath;
}

function inNodeModules(filePath: string): boolean {
  return filePath.includes('/node_modules/') || filePath.includes('\\node_modules\\');
}

function isDts(filePath: string): boolean {
  return filePath.endsWith('.d.ts');
}

function getDeclName(fn: FnLike): string {
  if (Node.isFunctionDeclaration(fn)) {
    return fn.getName() || '<anonymous function>';
  }
  if (Node.isMethodDeclaration(fn)) {
    const cls = fn.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
    const clsName = cls?.getName() || '<anonymous class>';
    const m = fn.getName() || '<anonymous method>';
    return `${clsName}.${m}()`;
  }
  if (Node.isArrowFunction(fn) || Node.isFunctionExpression(fn)) {
    const vd = fn.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    if (vd) return `${vd.getName()}()`;
    const pa = fn.getFirstAncestorByKind(SyntaxKind.PropertyAssignment);
    if (pa) return `${pa.getName()}()`;
    // object method shorthand won't be Arrow/FunctionExpression, but handle anyway
    return '<anonymous fn>()';
  }
  return '<fn>()';
}

function functionId(fn: FnLike | SourceFile, label?: string): string {
  if (Node.isSourceFile(fn)) {
    const fileAbs = fn.getFilePath();
    return `${fileAbs}#<module>`;
  }
  const sf = fn.getSourceFile().getFilePath();
  const line = fn.getStartLineNumber();
  const nm = label || getDeclName(fn);
  return `${sf}#${nm}@${line}`;
}

function exportedFlag(fn: FnLike): boolean {
  if (Node.isFunctionDeclaration(fn)) return fn.isExported() || fn.isDefaultExport();
  if (Node.isMethodDeclaration(fn)) return false; // methods are not top-level exports
  // for var-assigned functions, check variable export
  const vd = fn.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (vd) {
    const vdStmt = vd.getFirstAncestorByKind(SyntaxKind.VariableStatement);
    return vdStmt?.isExported() || false;
  }
  return false;
}

function getParamTypes(fn: FnLike): { name: string; type: string }[] {
  try {
    return fn.getParameters().map(p => ({
      name: p.getName(),
      type: p.getType().getText(p)
    }));
  } catch {
    return fn.getParameters().map(p => ({ name: p.getName(), type: 'unknown' }));
  }
}

function getReturnType(fn: FnLike): string {
  try {
    return fn.getReturnType().getText(fn);
  } catch {
    return 'unknown';
  }
}

function nearestEnclosingFunction(node: Node): FnLike | null {
  return node.getFirstAncestor(a => Node.isFunctionDeclaration(a) || Node.isMethodDeclaration(a) || Node.isArrowFunction(a) || Node.isFunctionExpression(a)) as FnLike | null;
}

function resolveAliasedSymbol(sym: MorphSymbol | undefined): MorphSymbol | undefined {
  if (!sym) return undefined;
  try {
    const aliased = sym.getAliasedSymbol();
    return aliased || sym;
  } catch {
    return sym;
  }
}

function resolveCalleeDeclaration(callNode: Node): Node | undefined {
  // callNode is a CallExpression
  const expr = (callNode as any).getExpression?.();
  if (!expr) return undefined;

  // For property access, prefer the name node's symbol (method symbol)
  let sym: MorphSymbol | undefined = undefined;
  if (Node.isPropertyAccessExpression(expr)) {
    sym = expr.getNameNode().getSymbol() || expr.getSymbol();
  } else {
    sym = expr.getSymbol();
  }

  sym = resolveAliasedSymbol(sym);
  const decls = sym?.getDeclarations() || [];

  // Prefer function-like declarations
  let target: Node | undefined = decls.find(d => Node.isFunctionDeclaration(d) || Node.isMethodDeclaration(d) || Node.isFunctionExpression(d) || Node.isArrowFunction(d));
  if (!target) {
    // variables that hold functions
    const vd = decls.find(Node.isVariableDeclaration) as VariableDeclaration | undefined;
    const init = vd?.getInitializer();
    if (init && (Node.isFunctionExpression(init) || Node.isArrowFunction(init))) {
      target = init;
    }
  }

  // As a last resort, try signature declaration (e.g., from .d.ts)
  if (!target) {
    try {
      const sigs = (callNode as any).getType?.().getCallSignatures?.() || [];
      const sig = sigs[0];
      const decl = sig?.getDeclaration?.();
      if (decl) target = decl as Node;
    } catch { /* ignore */ }
  }

  return target;
}

// ------------------------------ Analysis ----------------------------

const nodes = new Map<string, NodeInfo>();
const edges = new Map<string, Map<string, number>>();

function addNodeFor(fn: FnLike | SourceFile, forceExternal = false): string {
  if (Node.isSourceFile(fn)) {
    const id = functionId(fn);
    if (!nodes.has(id)) {
      const fileAbs = fn.getFilePath();
      nodes.set(id, {
        id,
        name: '<module-init>',
        file: fileAbs,
        fileRel: rel(fileAbs),
        line: 1,
        kind: 'module',
        exported: false,
        external: forceExternal || inNodeModules(fileAbs) || isDts(fileAbs),
        params: [],
        returns: 'void'
      });
    }
    return id;
  }

  const id = functionId(fn);
  if (!nodes.has(id)) {
    const fileAbs = fn.getSourceFile().getFilePath();
    nodes.set(id, {
      id,
      name: getDeclName(fn),
      file: fileAbs,
      fileRel: rel(fileAbs),
      line: fn.getStartLineNumber(),
      kind: fn.getKindName(),
      exported: exportedFlag(fn),
      external: forceExternal || inNodeModules(fileAbs) || isDts(fileAbs),
      params: getParamTypes(fn),
      returns: getReturnType(fn)
    });
  }
  return id;
}

function addEdge(from: string, to: string) {
  if (!edges.has(from)) edges.set(from, new Map());
  const m = edges.get(from)!;
  m.set(to, (m.get(to) || 0) + 1);
}

// Walk each file
for (const sf of files) {
  // Register a synthetic module-init node for top-level calls
  const modId = addNodeFor(sf);

  // Find all call expressions
  const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const ce of calls) {
    const callerFn = nearestEnclosingFunction(ce) || null;
    const callerId = callerFn ? addNodeFor(callerFn) : modId;

    const calleeDecl = resolveCalleeDeclaration(ce);
    if (!calleeDecl) continue;

    // If callee is a declaration other than function-like, try to derive fn-like
    let calleeFn: FnLike | undefined;
    if (Node.isFunctionDeclaration(calleeDecl) || Node.isMethodDeclaration(calleeDecl) || Node.isArrowFunction(calleeDecl) || Node.isFunctionExpression(calleeDecl)) {
      calleeFn = calleeDecl as FnLike;
    } else if (Node.isVariableDeclaration(calleeDecl)) {
      const init = calleeDecl.getInitializer();
      if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) calleeFn = init as FnLike;
    }

    // For external signatures (.d.ts), we may not have a function-like node
    if (!calleeFn) {
      const declSf = (calleeDecl as Node).getSourceFile?.();
      if (!declSf) continue;
      const externalId = functionId(declSf, '<external>');
      const isExternal = true;
      addNodeFor(declSf, isExternal);
      addEdge(callerId, externalId);
      continue;
    }

    const includeExternal = !!args.external;
    const isExternal = inNodeModules(calleeFn.getSourceFile().getFilePath()) || isDts(calleeFn.getSourceFile().getFilePath());
    if (!includeExternal && isExternal) {
      // Skip edges pointing into node_modules/.d.ts unless explicitly requested
      continue;
    }

    const calleeId = addNodeFor(calleeFn);
    addEdge(callerId, calleeId);
  }
}

// Build module-level import edges
const moduleEdges = new Map<string, Set<string>>();
for (const sf of files) {
  const from = rel(sf.getFilePath());
  for (const imp of sf.getImportDeclarations()) {
    const target = imp.getModuleSpecifierSourceFile();
    if (!target) continue; // unresolved or external package
    const to = rel(target.getFilePath());
    if (!moduleEdges.has(from)) moduleEdges.set(from, new Set());
    moduleEdges.get(from)!.add(to);
  }
}

// ------------------------------ Emit JSON ---------------------------

const graph = {
  generatedAt: new Date().toISOString(),
  cwd: CWD,
  filesAnalyzed: files.length,
  nodes: Array.from(nodes.values()).sort((a, b) => a.fileRel.localeCompare(b.fileRel) || a.line - b.line),
  edges: Array.from(edges.entries()).flatMap(([from, m]) => Array.from(m.entries()).map(([to, count]) => ({ from, to, count }))),
  modules: Array.from(moduleEdges.entries()).flatMap(([from, set]) => Array.from(set.values()).map(to => ({ from, to })))
};

fs.writeFileSync(path.join(OUT_DIR, 'graph.json'), JSON.stringify(graph, null, 2), 'utf8');

// ------------------------------ Emit Mermaid (calls) ----------------

function asMermaidId(id: string): string { return 'n' + Buffer.from(id).toString('hex').slice(0, 24); }

function emitCallsMermaid() {
  const byFile = new Map<string, NodeInfo[]>();
  for (const n of graph.nodes) {
    const arr = byFile.get(n.fileRel) || [];
    arr.push(n);
    byFile.set(n.fileRel, arr);
  }

  let out = 'flowchart LR\n';
  out += '  linkStyle default interpolate basis\n';
  let i = 0;
  for (const [fileRel, list] of Array.from(byFile.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    const sgName = `sub${i++}`;
    out += `  subgraph ${sgName}[${shortFileLabel(fileRel)}]` + '\n';
    for (const n of list) {
      const id = asMermaidId(n.id);
      const label = `${n.name.replace(/"/g, '\"')}\\n${path.posix.basename(n.fileRel)}:${n.line}`;
      const cls = n.external ? ' ext' : '';
      out += `    ${id}["${label}"]:::fn${cls}\n`;
    }
    out += '  end\n';
  }

  for (const e of graph.edges) {
    const from = asMermaidId(e.from);
    const to = asMermaidId(e.to);
    const lbl = e.count > 1 ? `|${e.count}×|` : '';
    out += `  ${from} -->${lbl} ${to}\n`;
  }

  out += '\nclassDef fn stroke:#333,stroke-width:1px,fill:#fff;\n';
  out += 'classDef ext stroke-dasharray:3 3;\n';

  fs.writeFileSync(path.join(OUT_DIR, 'calls.mmd'), out, 'utf8');
}

emitCallsMermaid();

// ------------------------------ Emit Mermaid (modules) --------------

function emitModulesMermaid() {
  let out = 'flowchart LR\n';
  for (const [from, tos] of moduleEdges) {
    const fromId = 'f' + Buffer.from(from).toString('hex').slice(0, 10);
    out += `  ${fromId}["${shortFileLabel(from)}"]\n`;
    for (const to of tos) {
      const toId = 'f' + Buffer.from(to).toString('hex').slice(0, 10);
      out += `  ${fromId} --> ${toId}\n`;
      out += `  ${toId}["${shortFileLabel(to)}"]\n`;
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'modules.mmd'), out, 'utf8');
}

emitModulesMermaid();

// ------------------------------ Emit DOT (optional) -----------------

function emitDot() {
  let out = 'digraph G {\n  graph [rankdir=LR];\n  node [shape=box, fontsize=10];\n  edge [fontsize=9];\n';

  const byFile = new Map<string, NodeInfo[]>();
  for (const n of graph.nodes) {
    const arr = byFile.get(n.fileRel) || [];
    arr.push(n);
    byFile.set(n.fileRel, arr);
  }

  let clusterIdx = 0;
  for (const [fileRel, list] of Array.from(byFile.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    out += `  subgraph cluster_${clusterIdx++} {\n    label="${fileRel}";\n`;
    for (const n of list) {
      const id = asMermaidId(n.id);
      const label = `${n.name.replace(/"/g, '\\"')}\\n${path.posix.basename(n.fileRel)}:${n.line}`;
      const style = n.external ? ',style="dashed"' : '';
      out += `    ${id} [label="${label}"${style}];\n`;
    }
    out += '  }\n';
  }

  for (const e of graph.edges) {
    const from = asMermaidId(e.from);
    const to = asMermaidId(e.to);
    const lbl = e.count > 1 ? ` [label="${e.count}×"]` : '';
    out += `  ${from} -> ${to}${lbl};\n`;
  }

  out += '}\n';
  fs.writeFileSync(path.join(OUT_DIR, 'calls.dot'), out, 'utf8');
}

if (args.dot) emitDot();

console.log(`[ts-callgraph] Wrote: \n  - ${path.join(OUT_DIR, 'graph.json')}\n  - ${path.join(OUT_DIR, 'calls.mmd')}\n  - ${path.join(OUT_DIR, 'modules.mmd')}${args.dot ? `\n  - ${path.join(OUT_DIR, 'calls.dot')}` : ''}`);
