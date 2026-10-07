from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).parent
S = 2
W, H = 900 * S, 420 * S

NAVY = '#173d4d'
TEAL = '#2f766e'
SAGE = '#8bb9a9'
PALE = '#dcebe2'
GOLD = '#d4a35f'
CREAM = '#fff6e8'
CLAY = '#b96955'

def p(*pts):
    return [(int(x*S), int(y*S)) for x,y in pts]

def box(x0,y0,x1,y1):
    return (int(x0*S),int(y0*S),int(x1*S),int(y1*S))

def canvas():
    return Image.new('RGBA',(W,H),(0,0,0,0))

def save(im,name):
    im.resize((900,420),Image.Resampling.LANCZOS).save(OUT/name,optimize=True)

def circle(d,x,y,r,fill,outline=None,width=1):
    d.ellipse(box(x-r,y-r,x+r,y+r),fill=fill,outline=outline,width=width*S)

def roundrect(d,coords,r,fill,outline=None,width=1):
    d.rounded_rectangle(box(*coords),radius=r*S,fill=fill,outline=outline,width=width*S)

def shadow(im,shape,blur=17,alpha=36):
    layer=canvas(); d=ImageDraw.Draw(layer)
    d.rounded_rectangle(box(*shape),radius=18*S,fill=(10,45,50,alpha))
    im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur*S)))

# Directory: an intentionally abstract, welcoming group portrait.
im=canvas(); d=ImageDraw.Draw(im)
circle(d,462,198,181,'#cfe3d8')
d.arc(box(270,26,664,414),190,348,fill=GOLD,width=5*S)
d.arc(box(90,112,384,414),205,343,fill='#a8cabc',width=5*S)
circle(d,160,90,8,GOLD); circle(d,740,294,7,TEAL)
for cx,cy,scale,body,skin in [
    (316,183,.92,'#448477','#dbad83'),
    (478,143,1.15,NAVY,'#e2b68d'),
    (637,190,.89,'#b8865a','#c18b68')]:
    headr=47*scale
    # shoulders and garments are broad simple forms at small display sizes.
    d.ellipse(box(cx-91*scale,cy+37*scale,cx+91*scale,cy+241*scale),fill=body)
    roundrect(d,(cx-77*scale,cy+97*scale,cx+77*scale,cy+292*scale),25*scale,body)
    circle(d,cx,cy,headr,skin)
    d.pieslice(box(cx-headr-4,cy-headr-12,cx+headr+4,cy+headr+4),180,358,fill='#294d4f')
    d.arc(box(cx-headr+7,cy-headr+6,cx+headr-7,cy+headr-7),190,346,fill='#294d4f',width=7*S)
    d.arc(box(cx-10*scale,cy+10*scale,cx+11*scale,cy+21*scale),7,170,fill='#8c5c49',width=2*S)
d.ellipse(box(184,348,754,420),fill='#8bb9a9')
d.line(p((154,368),(205,294),(228,310)),fill='#5c9a80',width=6*S,joint='curve')
d.ellipse(box(197,280,231,310),fill='#5c9a80')
d.line(p((751,353),(704,281),(679,302)),fill='#5c9a80',width=6*S,joint='curve')
d.ellipse(box(673,278,708,306),fill='#5c9a80')
save(im,'community-people.png')

# Lending: a paper agreement with a golden seal, gently held on either side.
im=canvas(); d=ImageDraw.Draw(im)
circle(d,460,212,177,'#2c6970')
d.arc(box(276,25,655,406),195,344,fill='#d4a35f',width=5*S)
shadow(im,(304,105,637,350),13,40); d=ImageDraw.Draw(im)
roundrect(d,(311,92,630,334),23,CREAM)
d.polygon(p((340,135),(470,246),(598,135)),fill='#e8d9bc')
d.line(p((338,136),(470,249),(600,136)),fill='#ba9462',width=4*S,joint='curve')
d.line(p((339,289),(421,215)),fill='#ba9462',width=4*S)
d.line(p((600,289),(519,215)),fill='#ba9462',width=4*S)
circle(d,468,243,32,GOLD)
circle(d,468,243,23,'#ebc991',outline='#ac7736',width=3)
# Two cropped helping hands, rendered as quiet silhouettes.
d.polygon(p((64,338),(153,246),(220,231),(310,281),(314,315),(252,325),(200,370),(171,420),(40,420)),fill='#96bbab')
d.polygon(p((827,420),(767,359),(699,335),(634,319),(621,285),(693,252),(748,270),(856,341),(900,378),(900,420)),fill='#d4a35f')
d.line(p((218,232),(265,266),(309,281)),fill='#6e9f90',width=5*S,joint='curve')
d.line(p((692,254),(650,281),(621,286)),fill='#bd894b',width=5*S,joint='curve')
circle(d,199,117,9,GOLD);circle(d,723,118,6,'#8bb9a9')
save(im,'community-lending.png')

# Archive: layered folders and a visible paper tab.
im=canvas(); d=ImageDraw.Draw(im)
circle(d,454,213,180,'#eadcc7')
d.arc(box(275,25,647,405),194,351,fill='#c39253',width=5*S)
shadow(im,(258,118,656,365),15,43); d=ImageDraw.Draw(im)
roundrect(d,(275,92,601,309),16,'#87aaa0')
roundrect(d,(307,122,638,333),16,'#448177')
roundrect(d,(337,75,546,278),11,'#fff9ed')
d.line(p((366,131),(512,131)),fill='#b1bbb0',width=5*S)
d.line(p((366,158),(489,158)),fill='#b1bbb0',width=5*S)
d.line(p((366,185),(504,185)),fill='#b1bbb0',width=5*S)
roundrect(d,(278,178,676,366),19,NAVY)
roundrect(d,(278,166,421,211),10,NAVY)
d.line(p((306,260),(646,260)),fill='#476b70',width=5*S)
roundrect(d,(433,278,518,314),7,GOLD)
d.polygon(p((449,297),(464,309),(494,282)),fill=None)
d.line(p((449,296),(463,310),(498,283)),fill='#fff7e7',width=6*S,joint='curve')
circle(d,194,279,7,TEAL);circle(d,713,98,9,GOLD)
save(im,'community-archive.png')
