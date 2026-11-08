#!/usr/bin/env python3
"""Makes data/philly-map.json: the shapes the Passport's cartoon map of Philadelphia is drawn from.

Run once, and again only if a source below changes:

    pip install shapely
    python3 scripts/philly-map.py <philadelphia-neighborhoods.geojson> <ne_10m_rivers_north_america.geojson>

Sources (both say so on the map):
- Neighborhoods: "Philadelphia Neighborhoods" by Robert Cheetham, OpenDataPhilly, CC BY 4.0
  (https://opendataphilly.org/datasets/philadelphia-neighborhoods; the GeoJSON is
  github.com/opendataphilly/open-geo-data, philadelphia-neighborhoods/philadelphia-neighborhoods.geojson).
- The Schuylkill: Natural Earth's North American rivers (public domain), with its course past Center City redrawn
  by hand from landmarks, since the generalized line runs about a kilometre west there.
- The Delaware is the city's own edge: the neighborhoods run to the state line in the middle of the river, so the
  river is drawn along that edge.

The output is in map units: x to the east and y to the south, 1000 across the city, with the projection kept in the
file so the build can place any latitude and longitude on it. Shapes are simplified to about half a unit.
"""
import json, re, sys, math
from shapely.geometry import shape, Point, LineString, Polygon, MultiPolygon
from shapely.ops import unary_union, transform

hoods_file, rivers_file = sys.argv[1], sys.argv[2]
src = json.load(open(hoods_file))

LON0, LAT1 = -75.2803, 40.1380              # the city's west and north edges
COS = math.cos(math.radians(40.0))
K = 1000 / ((-74.9557 - LON0) * COS)        # map units per degree of latitude
PAD = 30                                    # room around the city for the river and the frame


def proj(lon, lat, *_):
    return ((lon - LON0) * COS * K + PAD, (LAT1 - lat) * K + PAD)


def projg(g):
    return transform(lambda x, y, z=None: proj(x, y), g)


def d_of(ring):
    pts = list(ring.coords)
    if pts[0] == pts[-1]: pts = pts[:-1]
    return 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + 'Z'


def slug(n):
    return re.sub(r'[^a-z0-9]+', '-', n.lower()).strip('-')


def nice(n):
    return n.replace(' - ', ' – ')


TOL = 0.5
hoods = []
geoms = []
for f in src['features']:
    name = f['properties']['MAPNAME']
    g = projg(shape(f['geometry'])).buffer(0)
    geoms.append(g)
    s = g.simplify(TOL, preserve_topology=True)
    parts = list(s.geoms) if isinstance(s, MultiPolygon) else [s]
    parts = [p for p in parts if p.area > 2]   # drop slivers
    d = ''.join(d_of(p.exterior) for p in parts)
    c = g.representative_point()
    hoods.append({'id': slug(name), 'name': nice(name), 'd': d, 'c': [round(c.x, 1), round(c.y, 1)], 'a': round(g.area)})

# The city's outline, slivers between neighborhoods closed.
city = unary_union([g.buffer(0.8) for g in geoms]).buffer(-0.8)
if isinstance(city, MultiPolygon):
    city = max(city.geoms, key=lambda p: p.area)
outline = Polygon(city.exterior).simplify(TOL)
W = math.ceil(max(x for x, _ in outline.exterior.coords) + PAD)
H = math.ceil(max(y for _, y in outline.exterior.coords) + PAD)

# The Delaware: the stretch of the outline from the city's eastern tip, past the Navy Yard, to the airport.
ring = list(outline.exterior.coords)[:-1]
near = lambda pt: min(range(len(ring)), key=lambda i: (ring[i][0] - pt[0]) ** 2 + (ring[i][1] - pt[1]) ** 2)
ne = max(range(len(ring)), key=lambda i: ring[i][0])                 # the eastern tip, at Poquessing Creek
sw = near(proj(-75.262, 39.872))                                       # Darby Creek's mouth, by the airport
via = near(proj(-75.165, 39.893))                                      # the Navy Yard's shore
n = len(ring)
fwd = [(ne + k) % n for k in range((sw - ne) % n + 1)]
back = [(ne - k) % n for k in range((ne - sw) % n + 1)]
arc = fwd if via in fwd else back
delaware = 'M' + 'L'.join(f'{ring[i][0]:.1f},{ring[i][1]:.1f}' for i in arc)

# The Schuylkill: Natural Earth upstream and down, redrawn past Center City.
rv = json.load(open(rivers_file))
sch = [shape(ft['geometry']) for ft in rv['features'] if ft['geometry'] and ft['properties'].get('name') == 'Schuylkill']
pts = []
for g in sch:
    for line in (g.geoms if hasattr(g, 'geoms') else [g]):
        pts += [(x, y) for x, y in line.coords if -75.29 <= x <= -75.15 and 39.87 <= y <= 40.08]
pts.sort(key=lambda p: -p[1])   # north to south
by_hand = [   # (lat, lon): from the Falls Bridge down to Grays Ferry
    (40.0093, -75.1950), (40.0010, -75.1945), (39.9930, -75.1938), (39.9840, -75.1955), (39.9762, -75.1925),
    (39.9705, -75.1882), (39.9665, -75.1850), (39.9605, -75.1815), (39.9548, -75.1797), (39.9500, -75.1820),
    (39.9455, -75.1862), (39.9420, -75.1950), (39.9395, -75.2015),
]
north = [p for p in pts if p[1] > 40.0093]
south = [p for p in pts if p[1] < 39.9395]
course = north + [(lon, lat) for lat, lon in by_hand] + south
xy = [proj(lon, lat) for lon, lat in course]


def smooth(points):   # Catmull-Rom through the points, as cubic curves
    out = f'M{points[0][0]:.1f},{points[0][1]:.1f}'
    for i in range(len(points) - 1):
        p0 = points[i - 1] if i > 0 else points[i]
        p1, p2 = points[i], points[i + 1]
        p3 = points[i + 2] if i + 2 < len(points) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        out += f'C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}'
    return out


schuylkill = smooth(xy)

# Landmarks the map draws, by where they are.
LANDMARKS = [
    ('city-hall', 'City Hall', 39.9526, -75.1635), ('love', 'LOVE Park', 39.9545, -75.1660),
    ('liberty-bell', 'Liberty Bell', 39.9496, -75.1503), ('art-museum', 'Art Museum steps', 39.9656, -75.1810),
    ('zoo', 'Philadelphia Zoo', 39.9714, -75.1955), ('boathouses', 'Boathouse Row', 39.9692, -75.1874),
    ('franklin', 'Franklin Institute', 39.9582, -75.1731), ('bridge', 'Ben Franklin Bridge', 39.9531, -75.1345),
    ('stadiums', 'The stadiums', 39.9061, -75.1665), ('cheesesteak', 'Cheesesteaks', 39.9335, -75.1592),
    ('wissahickon', 'Wissahickon Valley', 40.0560, -75.2185), ('airport', 'The airport', 39.8744, -75.2424),
]
landmarks = [{'id': i, 'name': n, 'x': round(proj(lon, lat)[0], 1), 'y': round(proj(lon, lat)[1], 1)} for i, n, lat, lon in LANDMARKS]

out = {
    'about': 'The Passport map of Philadelphia. Made by scripts/philly-map.py; see it for the sources.',
    'attribution': 'Neighborhoods: Robert Cheetham, OpenDataPhilly (CC BY 4.0). Schuylkill: Natural Earth.',
    'proj': {'lon0': LON0, 'lat1': LAT1, 'cos': round(COS, 6), 'k': round(K, 3), 'pad': PAD},
    'size': [W, H],
    'outline': d_of(outline.exterior),
    'delaware': delaware,
    'schuylkill': schuylkill,
    'landmarks': landmarks,
    'hoods': sorted(hoods, key=lambda h: h['name']),
}
json.dump(out, open('data/philly-map.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print(f'{len(hoods)} neighborhoods, {W}x{H}, {len(json.dumps(out)) // 1024} KB')
