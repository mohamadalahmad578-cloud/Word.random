import sys,struct,hashlib,hmac,base64,re
from cryptography.hazmat.primitives.ciphers import Cipher,algorithms,modes
def dec(k,iv,d): c=Cipher(algorithms.AES(k),modes.CBC(iv)).decryptor(); return c.update(d)+c.finalize()
f=open(sys.argv[1],'rb').read(); pw=sys.argv[2]; orig=open(sys.argv[3],'rb').read()
H=f[:512]; assert H[:8]==bytes.fromhex('D0CF11E0A1B11AE1')
nfat,dirst=struct.unpack_from('<II',H,44)[0],struct.unpack_from('<i',H,48)[0]
mfst,nmf,difst,ndif=struct.unpack_from('<iIiI',H,60)
sec=lambda i:f[512*(i+1):512*(i+2)]
difat=list(struct.unpack_from('<109i',H,76))[:nfat]
d=difst
while len(difat)<nfat: s=sec(d); difat+=list(struct.unpack_from('<127i',s))[:nfat-len(difat)]; d=struct.unpack_from('<i',s,508)[0]
fat=[]
for fs in difat: fat+=struct.unpack_from('<128i',sec(fs))
def chain(st,t):
    o=[];seen=set()
    while st>=0: assert st not in seen; seen.add(st); o.append(st); st=t[st]
    return o
dirb=b''.join(sec(i) for i in chain(dirst,fat))
ents=[]
for i in range(len(dirb)//128):
    e=dirb[i*128:i*128+128]; nl=struct.unpack_from('<H',e,64)[0]; name=e[:max(0,nl-2)].decode('utf-16le')
    typ=e[66]; L,R,C=struct.unpack_from('<iii',e,68); st,sz=struct.unpack_from('<iI',e,116); ents.append((name,typ,L,R,C,st,sz))
minifat=[]
for s_ in chain(mfst,fat) if nmf else []: minifat+=struct.unpack_from('<128i',sec(s_))
root=ents[0]; ministream=b''.join(sec(i) for i in chain(root[5],fat))[:root[6]] if root[6] else b''
def read(e):
    if e[6]<4096: return b''.join(ministream[i*64:i*64+64] for i in chain(e[5],minifat))[:e[6]]
    return b''.join(sec(i) for i in chain(e[5],fat))[:e[6]]
# walk tree
def walk(i,depth,out):
    if i<0: return
    e=ents[i]; walk(e[2],depth,out); out.append((depth,e)); 
    if e[1] in (1,5): walk(e[4],depth+1,out)
    walk(e[3],depth,out)
out=[];walk(0,0,out) if False else None
tree=[];
def w2(i,d):
    if i<0:return
    e=ents[i];w2(e[2],d);tree.append('  '*d+repr(e[0])+(' (%d)'%e[6] if e[1]==2 else ''));
    if e[1]==1: w2(e[4],d+1)
    w2(e[3],d)
tree.append("Root"); w2(ents[0][4],1); print('\n'.join(tree))
byname={e[0]:e for e in ents}
info=read(byname['EncryptionInfo']); pkg=read(byname['EncryptedPackage'])
assert info[:8]==bytes([4,0,4,0,0x40,0,0,0]); xml=info[8:].decode()
g=lambda tag,attr: re.search(tag+r'[^>]*?\s'+attr+r'="([^"]*)"',xml).group(1)
kdsalt=base64.b64decode(g('<keyData','saltValue')); pwsalt=base64.b64decode(g('<p:encryptedKey','saltValue')); spin=int(g('<p:encryptedKey','spinCount'))
h=hashlib.sha512(pwsalt+pw.encode('utf-16le')).digest()
for i in range(spin): h=hashlib.sha512(struct.pack('<I',i)+h).digest()
dk=lambda b:hashlib.sha512(h+bytes.fromhex(b)).digest()[:32]
vi=dec(dk('fea7d2763b4b9e79'),pwsalt,base64.b64decode(g('<p:encryptedKey','encryptedVerifierHashInput')))
vv=dec(dk('d7aa0f6d3061344e'),pwsalt,base64.b64decode(g('<p:encryptedKey','encryptedVerifierHashValue')))
print('verifier ok:',hashlib.sha512(vi).digest()==vv[:64])
sk=dec(dk('146e0be7abacd0d6'),pwsalt,base64.b64decode(g('<p:encryptedKey','encryptedKeyValue')))[:32]
size=struct.unpack_from('<Q',pkg,0)[0]; body=pkg[8:]; plain=b''
for i in range(0,len(body),4096):
    iv=hashlib.sha512(kdsalt+struct.pack('<I',i//4096)).digest()[:16]; plain+=dec(sk,iv,body[i:i+4096])
plain=plain[:size]; print('package identical:',plain==orig, size, len(orig))
hk=dec(sk,hashlib.sha512(kdsalt+bytes.fromhex('5fb2ad010cb9e1f6')).digest()[:16],base64.b64decode(g('<dataIntegrity','encryptedHmacKey')))[:64]
hv=dec(sk,hashlib.sha512(kdsalt+bytes.fromhex('a0677f02b22c8433')).digest()[:16],base64.b64decode(g('<dataIntegrity','encryptedHmacValue')))[:64]
print('hmac ok:',hmac.new(hk,pkg,hashlib.sha512).digest()==hv)
