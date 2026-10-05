import zipfile, sys, re, posixpath
from lxml import etree
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
js=open('/home/claude/lec2docx/restyle.js').read()
ORD={k:re.findall(r'"(\w+)"',v) for k,v in re.findall(r'(\w+): \[([^\]]+)\]',js.split('var ORD')[1].split('};')[0])}
def check(f):
    z=zipfile.ZipFile(f); names=set(z.namelist()); errs=[]
    ct=etree.fromstring(z.read('[Content_Types].xml'))
    defs={d.get('Extension').lower() for d in ct if d.tag.endswith('Default')}
    ovs={o.get('PartName') for o in ct if o.tag.endswith('Override')}
    for n in names:
        if n.endswith('/'): continue
        if '/'+n not in ovs and n.rsplit('.',1)[-1].lower() not in defs: errs.append('no content type: '+n)
    for o in ovs:
        if o[1:] not in names: errs.append('override for missing part '+o)
    docs={}
    for n in names:
        if n.endswith('.xml') or n.endswith('.rels'):
            try: docs[n]=etree.fromstring(z.read(n))
            except Exception as e: errs.append('XML %s %s'%(n,e))
    # rels
    for n in [x for x in names if x.endswith('.rels')]:
        base=posixpath.dirname(posixpath.dirname(n)); part=posixpath.join(base,posixpath.basename(n)[:-5])
        ids=set()
        for r in docs[n]:
            if r.get('Id') in ids: errs.append('dup rel id %s in %s'%(r.get('Id'),n))
            ids.add(r.get('Id'))
            if r.get('TargetMode')=='External': continue
            t=posixpath.normpath(posixpath.join(base,r.get('Target'))).lstrip('/') if not r.get('Target').startswith('/') else r.get('Target')[1:]
            if t not in names: errs.append('rel target missing %s -> %s'%(n,t))
        if part in docs:
            for el in docs[part].iter():
                for a,v in el.attrib.items():
                    if a.startswith(R) and v not in ids: errs.append('dangling %s=%s in %s'%(a,v,part))
    for n in [x for x in docs if x.startswith('word/') and x.endswith('.xml')]:
        rn=posixpath.join('word/_rels',posixpath.basename(n)+'.rels')
        if rn not in names and any(a.startswith(R) for el in docs[n].iter() for a in el.attrib): errs.append('rIds but no rels: '+n)
    # docPr ids across doc+headers+footers
    seen={}
    for n in docs:
        if not n.startswith('word/') or n.endswith('.rels'): continue
        for el in docs[n].iter('{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}docPr'):
            seen.setdefault(el.get('id'),[]).append(n)
    d=[(k,v) for k,v in seen.items() if len(v)>1]
    if d: errs.append('DUP docPr ids: %s'%d[:6])
    # bookmarks
    for n in docs:
        if not n.startswith('word/') or n.endswith('.rels'): continue
        bid={};bnm={}
        for b in docs[n].iter(W+'bookmarkStart'):
            bid[b.get(W+'id')]=bid.get(b.get(W+'id'),0)+1; bnm[b.get(W+'name')]=bnm.get(b.get(W+'name'),0)+1
        dd=[k for k,v in bid.items() if v>1]; dn=[k for k,v in bnm.items() if v>1]
        if dd: errs.append('dup bookmark ids in %s: %s'%(n,dd[:8]))
        if dn: errs.append('dup bookmark names in %s: %s'%(n,dn[:8]))
    # order
    bad={}
    for n in docs:
        if not n.startswith('word/') or n.endswith('.rels'): continue
        for k,order in ORD.items():
            for el in docs[n].iter(W+k):
                seq=[c.tag[len(W):] for c in el if c.tag.startswith(W)]
                idx=[order.index(s) if s in order else -1 for s in seq]
                if -1 in idx: bad.setdefault((n,k,'unknown '+str([s for s in seq if s not in order])),0); continue
                if idx!=sorted(idx) or len(set(seq))!=len(seq): bad[(n,k,str(seq))]=bad.get((n,k,str(seq)),0)+1
    for k,v in list(bad.items())[:8]: errs.append('ORDER %s x%d'%(k,v))
    # sectPr refs
    dx=docs['word/document.xml']
    for i,sp in enumerate(dx.iter(W+'sectPr')):
        hr=[(h.get(W+'type')) for h in sp.findall(W+'headerReference')]
        errs.append('info sect%d hdr=%s titlePg=%s'%(i,hr,sp.find(W+'titlePg') is not None))
    st=docs.get('word/settings.xml'); 
    if st is not None and st.find(W+'evenAndOddHeaders') is not None: errs.append('info evenAndOdd still set')
    return errs
for f in sys.argv[1:]:
    print('==',f); [print('  ',e) for e in check(f)]
