"""
Makes the strong and weak chart for Maths Monsters (src/games/monsters/art/type-chart.webp) from the type wheel in
shared/monsters/types.ts, the painted monsters, and the background painted on the gaming PC (docs/monsters-art/type-chart-bg.webp).
Run with ~/.cache/rembg-venv/bin/python scripts/monsters-type-chart.py
"""
import math, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT=Path(__file__).resolve().parent.parent; OUT=ROOT/'src/games/monsters/art/type-chart.webp'
src=(ROOT/'shared/monsters/types.ts').read_text()
TYPES=re.findall(r"'(\w+)'",re.search(r"TYPES: readonly TypeId\[\] = \[(.*?)\]",src).group(1))
PAL=dict(leaf=('#4ade80','#15803d'),water=('#38bdf8','#0369a1'),fire=('#fb923c','#b45309'),ice=('#a5f3fc','#0e7490'),spark=('#fde047','#a16207'),stone=('#a8a29e','#44403c'))
MON=dict(leaf='digibud',water='plusplash',fire='multipup',ice='divvy',spark='fractopus',stone='coinrock')
K=2; W=1600*K
INK='#1e293b'; GOLD='#f59e0b'; CREAM='#fffaf0'
def F(s,name='SFNSRounded.ttf'):
    p=Path('/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf')
    return ImageFont.truetype(str(p),s*K)
bg=Image.open(ROOT/'docs/monsters-art/type-chart-bg.webp').convert('RGB').resize((W,W),Image.LANCZOS).convert('RGBA')
# a soft pale wash so words read easily
wash=Image.new('RGBA',(W,W),(255,250,235,70)); bg=Image.alpha_composite(bg,wash)
d=ImageDraw.Draw(bg)
def ctext(x,y,t,f,fill=INK,**kw): d.text((x*K,y*K),t,font=f,fill=fill,anchor='mm',**kw)
def pill(x,y,w,h,fill=CREAM,line=None,lw=0,r=None):
    d.rounded_rectangle(((x-w/2)*K,(y-h/2)*K,(x+w/2)*K,(y+h/2)*K),radius=(r or h/2)*K,fill=fill,outline=line,width=lw*K)
# Title
pill(800,80,1000,104,fill=INK)
ctext(800,80,'Who is strong against who?',F(58),fill='#ffffff')
CX,CY,R=800,705,392
NODE=120
ang=lambda i:-90+i*60
pos=lambda i:(CX+R*math.cos(math.radians(ang(i))),CY+R*math.sin(math.radians(ang(i))))
# Arrows: an arc from each type to the one it is strong against
def on(a,r): return ((CX+r*math.cos(math.radians(a)))*K,(CY+r*math.sin(math.radians(a)))*K)
def arrow(a0,a1,half,head,fill,tip):
    n=40
    outer=[on(a0+(a1-a0)*j/n,R+half) for j in range(n+1)]
    inner=[on(a0+(a1-a0)*j/n,R-half) for j in range(n+1)]
    d.polygon(outer+inner[::-1],fill=fill)
    d.polygon([on(a1,R+head),on(tip,R),on(a1,R-head)],fill=fill)
for i in range(6):
    a0,a1=ang(i)+24,ang(i)+60-30
    arrow(a0-.8,a1,18,42,INK,a1+9)
    arrow(a0,a1+1.3,11,27,GOLD,a1+7.2)
# Nodes
for i,t in enumerate(TYPES):
    x,y=pos(i); main,dark=PAL[t]
    sh=Image.new('RGBA',(W,W),(0,0,0,0)); ImageDraw.Draw(sh).ellipse(((x-NODE)*K,(y-NODE+10)*K,(x+NODE)*K,(y+NODE+10)*K),fill=(30,41,59,110))
    bg.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10*K))); d=ImageDraw.Draw(bg)
    d.ellipse(((x-NODE)*K,(y-NODE)*K,(x+NODE)*K,(y+NODE)*K),fill=main,outline=dark,width=9*K)
    m=Image.open(ROOT/f'src/games/monsters/art/painted/monsters/{MON[t]}-1.webp').convert('RGBA')
    bb=m.getchannel('A').getbbox(); m=m.crop(bb); s=NODE*1.72*K/max(m.size); m=m.resize((int(m.width*s),int(m.height*s)),Image.LANCZOS)
    bg.alpha_composite(m,(int(x*K-m.width/2),int((y-14)*K-m.height/2))); d=ImageDraw.Draw(bg)
    pill(x,y+NODE-2,170,54,fill=dark,line='#ffffff',lw=3)
    ctext(x,y+NODE-2,t.capitalize(),F(34),fill='#ffffff')
# Middle
pill(CX,CY,410,280,fill=CREAM,line=INK,lw=5,r=36)
ctext(CX,CY-84,'Follow the arrows',F(36))
first,second=TYPES[0],TYPES[1]
ctext(CX,CY-28,'Each monster is strong',F(29),fill='#475569')
ctext(CX,CY+8,'against the one it points at.',F(26),fill='#475569')
ctext(CX,CY+52,f'{first.capitalize()} is strong',F(32),fill='#b45309')
ctext(CX,CY+90,f'against {second.capitalize()}',F(32),fill='#b45309')
# Key
y0=1325
pill(800,y0+80,1400,236,fill=CREAM,line=INK,lw=5,r=36)
cols=[(310,GOLD,'Strong','×1.5','Your arrow points at them','Your attack does more'),(800,'#64748b','Normal','×1','No arrow between you','Your attack is normal'),(1290,'#0369a1','Weak','×0.75','Their arrow points at you','Your attack does less')]
for x,c,a,b,l1,l2 in cols:
    pill(x,y0+22,300,64,fill=c if c!=GOLD else '#b45309')
    ctext(x,y0+22,f'{a}  {b}',F(36),fill='#ffffff')
    ctext(x,y0+88,l1,F(30)); ctext(x,y0+132,l2,F(27),fill='#475569')
bg.convert('RGB').resize((1200,1200),Image.LANCZOS).save(OUT,quality=82,method=6); print(OUT, OUT.stat().st_size//1024,'KB', TYPES)
