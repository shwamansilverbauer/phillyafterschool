#!/usr/bin/env python3
"""Checks src/qr.js, the QR encoder behind a premium listing's flyer.

    pip install qrcode zxing-cpp numpy
    python3 scripts/qr-check.py

Each test address is encoded by src/qr.js with every one of the eight masks and compared, grid for grid, with the
qrcode library; then the code src/qr.js would actually draw is read back with a separate decoder. Run it after any
change to src/qr.js.
"""
import json, os, subprocess, sys, random, qrcode, numpy as np, zxingcpp
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
texts=['A','https://phillyafterschool.org/','https://phillyafterschool.org/programs/old-pine/?utm_source=flyer&utm_medium=qr',
 'https://phillyafterschool.org/programs/school-of-philadelphia-ballet/?utm_source=flyer&utm_medium=qr',
 'https://phillyafterschool.org/summer-camps/coco-academy-summer-camp/?utm_source=flyer&utm_medium=qr']
random.seed(7)
abc='abcdefghijklmnopqrstuvwxyz0123456789-/?=&.:_%'
for n in list(range(1,214,7))+[14,15,26,27,42,43,62,63,84,85,106,107,122,123,152,153,180,181,212,213]:
    texts.append(''.join(random.choice(abc) for _ in range(n)))
texts.append('café – naïve ✓')
js = "const q=require('%s/src/qr.js');const t=JSON.parse(require('fs').readFileSync(0,'utf8'));const o=[];for(const x of t){const row={auto:q(x)};row.m=[];for(let k=0;k<8;k++)row.m.push(q(x,k));o.push(row)}console.log(JSON.stringify(o))" % REPO
out=json.loads(subprocess.run(['node','-e',js],input=json.dumps(texts),capture_output=True,text=True,check=True).stdout)
bad=0; same=0; read=0
for t,o in zip(texts,out):
    b=t.encode('utf8')
    for k in range(8):
        q=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M,border=0,mask_pattern=k)
        q.add_data(qrcode.util.QRData(b,mode=qrcode.util.MODE_8BIT_BYTE)); q.make(fit=True)
        ref=[''.join('1' if c else '0' for c in row) for row in q.get_matrix()]
        if ref!=o['m'][k]:
            bad+=1
            if bad<4: print('DIFFERS',len(b),'mask',k,'sizes',len(ref),len(o['m'][k]) if o['m'][k] else None)
        else: same+=1
    rows=o['auto']; n=len(rows); s=8; img=np.full(((n+8)*s,(n+8)*s),255,dtype=np.uint8)
    for r in range(n):
        for c in range(n):
            if rows[r][c]=='1': img[(r+4)*s:(r+5)*s,(c+4)*s:(c+5)*s]=0
    res=zxingcpp.read_barcodes(img)
    if res and res[0].text==t: read+=1
    else:
        bad+=1; print('NOT READ BACK',len(b),repr(t[:40]),[x.text[:30] for x in res])
print('texts',len(texts),'identical grids',same,'of',len(texts)*8,'read back',read,'of',len(texts),'| problems',bad)
print('too long gives null:', subprocess.run(['node','-e',"console.log(require('%s/src/qr.js')('x'.repeat(214)))"%REPO],capture_output=True,text=True).stdout.strip())
sys.exit(1 if bad else 0)
