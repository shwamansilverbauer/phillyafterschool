#!/usr/bin/env python3
"""Redraw the QR codes on the week card and the day-camp card for the site's address.

    pip install qrcode
    python3 scripts/card-qr.py

Reads "siteUrl" from site.config.json and rewrites the patterns in data/card-qr.json for <site>/w and <site>/d.
Where each short address leads ("goesTo") is left as it is. Run it when the site's address changes: a code drawn
for the old address still works for as long as that address forwards here, but new cards should carry the new one.
"""
import json, os, qrcode

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
site = json.load(open(os.path.join(ROOT, 'site.config.json'), encoding='utf8'))['siteUrl'].rstrip('/')
path = os.path.join(ROOT, 'data', 'card-qr.json')
data = json.load(open(path, encoding='utf8'))

def rows(text):
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
    q.add_data(text)   # capitals, so the code stays small enough to scan from a fridge door
    q.make(fit=True)
    return [''.join('1' if cell else '0' for cell in row) for row in q.get_matrix()]

data['text'] = (site + '/w').upper()
data['rows'] = rows(data['text'])
if 'dayoff' in data:
    data['dayoff']['text'] = (site + '/d').upper()
    data['dayoff']['rows'] = rows(data['dayoff']['text'])
json.dump(data, open(path, 'w', encoding='utf8'), indent=2)
open(path, 'a', encoding='utf8').write('\n')
print(data['text'], len(data['rows']), 'rows;', data.get('dayoff', {}).get('text', ''))
