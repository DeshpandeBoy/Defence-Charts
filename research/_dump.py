#!/usr/bin/env python3
"""Dump completed workflow agent results into readable markdown."""
import json, os, sys, glob

OUT = "/Users/dhanyarao/Documents/Sam/Defence/research/raw"
os.makedirs(OUT, exist_ok=True)

MARKERS = [
    ("chart-types/introduction.md",     (1, "basedash-chart-types",  "Basedash - per-chart-type spec")),
    ("features/dashboards.md",          (2, "basedash-grid-model",   "Basedash - dashboard grid, filters, embedding")),
    ("React charting landscape",        (3, "landscape-charting",    "React charting library landscape")),
    ("draggable/resizable 12-column",   (4, "landscape-grid-resize", "Dashboard grid / drag-resize landscape")),
    ("MOST IMPORTANT TASK",             (5, "theory-responsive-viz", "Responsive visualization theory + size ladder")),
    ("Two-part design research",        (6, "design-tokens-widgets", "Chart design tokens + widget aesthetics")),
    ("architecture + packaging",        (7, "arch-oss-packaging",    "OSS monorepo / packaging architecture")),
]

def prompt_of(agent_id, wfdir):
    p = os.path.join(wfdir, f"agent-{agent_id}.jsonl")
    if not os.path.exists(p):
        return ""
    with open(p, "r", errors="ignore") as f:
        first = f.readline()
    try:
        d = json.loads(first)
    except Exception:
        return ""
    c = d.get("message", {}).get("content", "")
    return c if isinstance(c, str) else json.dumps(c)

def main():
    wfdirs = sorted(glob.glob(
        "/Users/dhanyarao/.claude/projects/-Users-dhanyarao-Documents-Sam-Defence/*/subagents/workflows/wf_*"))
    written = []
    for wfdir in wfdirs:
        jp = os.path.join(wfdir, "journal.jsonl")
        if not os.path.exists(jp):
            continue
        for line in open(jp):
            try: d = json.loads(line)
            except: continue
            if d.get("type") != "result" or not d.get("result"):
                continue
            pr = prompt_of(d.get("agentId"), wfdir)
            hit = next((m for mk, m in MARKERS if mk in pr), None)
            order, slug, title = hit if hit else (9, f"unknown-{str(d.get('agentId'))[:8]}", "Unidentified agent")
            body = str(d["result"])
            fn = os.path.join(OUT, f"{order:02d}-{slug}.md")
            with open(fn, "w") as f:
                f.write(f"# {title}\n\n> workflow agent `{d.get('agentId')}` - {len(body):,} chars\n\n---\n\n{body}\n")
            written.append((fn, len(body)))
    for fn, n in sorted(set(written)):
        print(f"  {os.path.basename(fn):40} {n:>8,} chars")
    print(f"TOTAL: {len(set(written))} files")

main()
