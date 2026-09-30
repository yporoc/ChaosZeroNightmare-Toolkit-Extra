#!/usr/bin/env python3
# ChaosZero Toolkit Extra
# Copyright (C) 2026 ChaosZero-Toolkit contributors
# GNU General Public License v3, see LICENSE.
"""ssra 版繁转简：官方 lang_zht 的 text/zht/text.db 转简体后重建分卷并应用。

原理（build 84 实测）：
  manifest.ssra 文件记录 = 40B[路径哈希,组内偏移,压缩/解压尺寸,...,压缩方法,组号]
  .ssrc 分卷 = 16B 对齐条目(zstd 帧或裸文件) + 16B footer['SSRC',卷号,XXH64(载荷)]
  text.db = PLPcK v1，值结构 '<id>\\0<文本>\\0'，.db 存储态带 256B 内层 XOR（相位逐文件固定）
  启动器用 manifest.ssra.etag 里的 XXH64+size 校验本地 manifest，必须同步更新。
"""
import os
import struct
import collections

import xxhash
import zstandard as zstd
from opencc import OpenCC

from unpack_data import INNER_XOR_KEY

TEXT_DB = 'text/zht/text.db'
TARGET_PART = 'lang_zht_b03_0.ssrc'
ETAG_REL = 'manifest.ssra.etag'
PREV_REL = 'manifest.ssra.prev'
BACKUP_SUBDIR = 'backup_original'


def _inner_decrypt(data, phase):
    ks = (INNER_XOR_KEY[phase:] + INNER_XOR_KEY * (len(data) // 256 + 2))[:len(data)]
    return bytes(a ^ b for a, b in zip(data, ks))


def _find_phase(head):
    for boff in range(256):
        if all((head[i] ^ INNER_XOR_KEY[(i + boff) % 256]) == b'PLPcK'[i] for i in range(5)):
            return boff
    return None


class Ssra:
    """manifest.ssra + chunks/*.ssrc 只读视图。"""

    def __init__(self, gameres):
        self.gameres = gameres
        self.chunk_dir = os.path.join(gameres, 'chunks')
        d = open(os.path.join(gameres, 'manifest.ssra'), 'rb').read()
        assert d[:4] == b'SSRA', 'bad manifest magic'
        self.build = struct.unpack_from('<I', d, 8)[0]
        self.part_count, self.file_count = struct.unpack_from('<II', d, 12)
        self.names_off = struct.unpack_from('<I', d, 24)[0]
        self.files_off = struct.unpack_from('<Q', d, 0x30)[0]
        self.parts = []  # (idx, grp, k, payload_end, total, xxh64)
        for k in range(self.part_count):
            o = 0x40 + k * 32
            idx, grp, _ = struct.unpack_from('<IHH', d, o)
            self.parts.append((idx, grp, k) + struct.unpack_from('<QQQ', d, o + 8))
        self.part_names = []
        q = self.names_off
        for _ in range(self.part_count):
            e = d.index(b'\x00', q)
            self.part_names.append(d[q:e].decode('utf-8'))
            q = e + 1
        self.files = []  # dict(k,name,grp,meth,off,comp,dec)
        for k in range(self.file_count):
            o = self.files_off + k * 40
            off = struct.unpack_from('<Q', d, o + 8)[0]
            comp, dec = struct.unpack_from('<II', d, o + 16)
            noff = struct.unpack_from('<I', d, o + 28)[0]
            meth, grp = struct.unpack_from('<HH', d, o + 32)
            e = d.index(b'\x00', self.names_off + noff)
            name = d[self.names_off + noff:e].decode('utf-8')
            self.files.append(dict(k=k, name=name, grp=grp, meth=meth,
                                   off=off, comp=comp, dec=dec))
        bygrp = collections.defaultdict(list)
        for idx, grp, k, pe, tot, h in self.parts:
            bygrp[grp].append((idx, k, pe))
        self.gcum = {}
        for grp, lst in bygrp.items():
            lst.sort()
            tot, m = 0, []
            for idx, k, pe in lst:
                m.append((idx, k, tot, tot + pe))
                tot += pe
            self.gcum[grp] = (tot, m)

    def record(self, name):
        for f in self.files:
            if f['name'] == name:
                return f
        raise KeyError(name)

    def _read_group(self, grp, off, n):
        out = bytearray()
        for idx, k, s, e in self.gcum[grp][1]:
            if off < e and off + n > s:
                with open(os.path.join(self.chunk_dir, self.part_names[k]), 'rb') as f:
                    f.seek(max(off, s) - s)
                    out += f.read(min(off + n, e) - max(off, s))
        return bytes(out) if len(out) == n else None

    def extract(self, name, decrypt=True):
        f = self.record(name)
        blob = self._read_group(f['grp'], f['off'], f['comp'])
        if blob is None:
            raise IOError('span read failed: ' + name)
        if f['meth'] == 1:
            blob = zstd.ZstdDecompressor().decompressobj().decompress(blob)
        if decrypt and (name.endswith('.db') or name.endswith('.dblang')):
            phase = _find_phase(blob[:64])
            if phase is not None:
                blob = _inner_decrypt(blob, phase)
        return blob

    def verify_present(self):
        bad = 0
        for idx, grp, k, pe, tot, h in self.parts:
            p = os.path.join(self.chunk_dir, self.part_names[k])
            if not os.path.isfile(p):
                continue
            x = xxhash.xxh64()
            with open(p, 'rb') as f:
                remain = tot - 16
                while remain > 0:
                    b = f.read(min(1 << 22, remain))
                    remain -= len(b)
                    x.update(b)
            if x.intdigest() != h:
                bad += 1
        return bad


def parse_textdb(data):
    """返回 (43B头, 桶表[条目索引链], 条目[key,val,flags,原偏移])。"""
    assert data[:5] == b'PLPcK'
    hash_count = struct.unpack_from('<I', data, 21)[0]
    entries, index_by_off, buckets = [], {}, []
    for b in range(hash_count):
        o = 43 + b * 5
        chain = struct.unpack_from('<I', data, o + 1)[0] + (data[o] << 32)
        lst = []
        if chain:
            seen = set()
            while chain and chain + 15 <= len(data) and chain not in seen:
                seen.add(chain)
                if chain not in index_by_off:
                    dh = data[chain:chain + 15]
                    kl = dh[5]
                    vs = struct.unpack_from('<I', dh, 6)[0]
                    index_by_off[chain] = len(entries)
                    entries.append([data[chain + 15:chain + 15 + kl],
                                    data[chain + 15 + kl:chain + 15 + kl + vs], dh[4], chain])
                lst.append(index_by_off[chain])
                chain = struct.unpack_from('<I', data, chain + 11)[0] + (data[chain + 10] << 32)
        buckets.append(lst)
    assert sum(map(len, buckets)) == len(entries), '链覆盖不完整'
    return data[:43], hash_count, buckets, entries


def rebuild_textdb(header, hash_count, buckets, entries, new_values):
    nxt = {}
    for lst in buckets:
        for a, b in zip(lst, lst[1:]):
            nxt[a] = b
    phys = sorted(range(len(entries)), key=lambda i: entries[i][3])
    offs = [0] * len(entries)
    body = bytearray()
    cur = 43 + hash_count * 5
    for i in phys:
        key, _, flags, _ = entries[i]
        val = new_values.get(i, entries[i][1])
        offs[i] = cur
        cur += 15 + len(key) + len(val)
        body += struct.pack('<IBBIBI', 15 + len(key) + len(val), flags, len(key), len(val), 0, 0)
        body += key + val
    for i in range(len(entries)):
        p = 0 if i not in nxt else offs[nxt[i]]
        o = offs[i] - (43 + hash_count * 5) + 10
        body[o] = (p >> 32) & 0xFF
        struct.pack_into('<I', body, o + 1, p & 0xFFFFFFFF)
    ht = bytearray(hash_count * 5)
    for b, lst in enumerate(buckets):
        if lst:
            p = offs[lst[0]]
            ht[b * 5] = (p >> 32) & 0xFF
            struct.pack_into('<I', ht, b * 5 + 1, p & 0xFFFFFFFF)
    return header + bytes(ht) + bytes(body)


def convert_values(entries, stats):
    cc = OpenCC('t2s')
    new_values = {}
    for i, (key, val, flags, _) in enumerate(entries):
        j = val.find(b'\x00')
        if j < 0:
            stats['引用保持'] += 1
            continue
        tail = val[j + 1:]
        term = tail.endswith(b'\x00')
        text = tail[:-1] if term else tail
        if b'\x00' in text or not text:
            stats['跳过保持'] += 1
            continue
        try:
            s = text.decode('utf-8')
        except UnicodeDecodeError:
            stats['非文本保持'] += 1
            continue
        conv = cc.convert(s)
        conv2 = cc.convert(conv)
        if conv2 != conv:
            stats['二次转换'] += 1
            conv = conv2
        if conv == s:
            stats['已是简体'] += 1
            continue
        new_values[i] = val[:j + 1] + conv.encode('utf-8') + (b'\x00' if term else b'')
        stats['已转换'] += 1
    return new_values


def build(gameres, out_dir, log=print):
    """构建补丁到 out_dir，返回 (manifest_path, part_path)。"""
    S = Ssra(gameres)
    log('manifest build=%d parts=%d files=%d' % (S.build, S.part_count, S.file_count))
    f = S.record(TEXT_DB)
    part_k = [k for idx, k, s, e in S.gcum[f['grp']][1] if s <= f['off'] < e][0]
    part_name = S.part_names[part_k]
    assert part_name == TARGET_PART
    orig_part = open(os.path.join(S.chunk_dir, part_name), 'rb').read()
    local = f['off'] - [s for idx, k, s, e in S.gcum[f['grp']][1] if k == part_k][0]
    assert orig_part[local:local + 4] == b'\x28\xb5\x2f\xfd'
    assert orig_part[local + f['comp']:len(orig_part) - 16].strip(b'\x00') == b'', 'text.db 不是该卷最后条目'

    enc = S.extract(TEXT_DB, decrypt=False)
    phase = _find_phase(enc[:64])
    assert phase is not None, '未找到内层 XOR 相位'
    plain = _inner_decrypt(enc, phase)
    log('text.db 解密: phase=%d size=%d' % (phase, len(plain)))

    header, hash_count, buckets, entries = parse_textdb(plain)
    stats = collections.Counter()
    new_values = convert_values(entries, stats)
    log('转换统计: %s' % dict(stats))
    newdb = rebuild_textdb(header, hash_count, buckets, entries, new_values)
    # 自检：键集/桶分配/期望值逐条一致
    h2, hc2, b2, e2 = parse_textdb(newdb)
    assert len(e2) == len(entries) and hc2 == hash_count
    assert ({e[0] for e in entries} == {e[0] for e in e2})
    kb1 = {entries[i][0]: b for b, lst in enumerate(buckets) for i in lst}
    kb2 = {e2[i][0]: b for b, lst in enumerate(b2) for i in lst}
    assert kb1 == kb2, '桶分配漂移'
    expect = {entries[i][0]: v for i, v in new_values.items()}
    orig_by_key = {e[0]: e[1] for e in entries}
    for e in e2:
        want = expect.get(e[0], orig_by_key[e[0]])
        assert e[1] == want, '值不一致: %r' % e[0][:40]
    log('自检通过: %d 条，键集/桶分配/值全部一致' % len(e2))

    newdb_enc = _inner_decrypt(newdb, phase)
    frame = zstd.ZstdCompressor(level=3).compress(newdb_enc)
    pad = b'\x00' * ((-len(frame)) % 16)
    payload = orig_part[:local] + frame + pad
    part_idx = [idx for idx, k, s, e in S.gcum[f['grp']][1] if k == part_k][0]
    new_part = payload + b'SSRC' + struct.pack('<I', part_idx) + \
        struct.pack('<Q', xxhash.xxh64(payload).intdigest())

    man = bytearray(open(os.path.join(gameres, 'manifest.ssra'), 'rb').read())
    o = 0x40 + part_k * 32
    struct.pack_into('<QQQ', man, o + 8, len(new_part) - 16, len(new_part),
                     xxhash.xxh64(new_part[:-16]).intdigest())
    fo = S.files_off + f['k'] * 40
    struct.pack_into('<II', man, fo + 16, len(frame), len(newdb))
    man = bytes(man)

    os.makedirs(out_dir, exist_ok=True)
    open(os.path.join(out_dir, 'manifest.ssra'), 'wb').write(man)
    open(os.path.join(out_dir, TARGET_PART), 'wb').write(new_part)
    log('补丁已生成: manifest.ssra(%d) %s(%d)' % (len(man), part_name, len(new_part)))
    return os.path.join(out_dir, 'manifest.ssra'), os.path.join(out_dir, TARGET_PART)


def _etag_lines(path):
    return open(path, 'rb').read().split(b'\r\n')


def sync_identity(gameres, log=print):
    """把 etag 身份记录(XXH64+size)同步为当前 manifest；.prev 也指向当前 manifest。"""
    man_path = os.path.join(gameres, 'manifest.ssra')
    man = open(man_path, 'rb').read()
    etag = os.path.join(gameres, ETAG_REL)
    lines = _etag_lines(etag)
    lines[2] = str(xxhash.xxh64(man).intdigest()).encode()
    lines[3] = str(len(man)).encode()
    open(etag, 'wb').write(b'\r\n'.join(lines))
    open(os.path.join(gameres, PREV_REL), 'wb').write(man)
    log('身份记录已同步: hash=%s size=%s' % (lines[2].decode(), lines[3].decode()))


def apply(gameres, patch_dir, log=print):
    for rel in ('manifest.ssra', TARGET_PART):
        assert os.path.isfile(os.path.join(patch_dir, rel)), rel
    bd = os.path.join(patch_dir, BACKUP_SUBDIR)
    os.makedirs(bd, exist_ok=True)
    for rel in ('manifest.ssra', TARGET_PART, ETAG_REL):
        src = os.path.join(gameres, rel)
        dst = os.path.join(bd, rel.replace('/', '__') + '.bak')
        if os.path.isfile(src) and not os.path.isfile(dst):
            open(dst, 'wb').write(open(src, 'rb').read())
            log('备份 %s' % rel)
    for rel in ('manifest.ssra', TARGET_PART):
        open(os.path.join(gameres, rel), 'wb').write(
            open(os.path.join(patch_dir, rel), 'rb').read())
        log('应用 %s' % rel)
    sync_identity(gameres, log)


def restore(gameres, patch_dir, log=print):
    bd = os.path.join(patch_dir, BACKUP_SUBDIR)
    for rel in (TARGET_PART, 'manifest.ssra', ETAG_REL):
        bak = os.path.join(bd, rel.replace('/', '__') + '.bak')
        assert os.path.isfile(bak), bak
        open(os.path.join(gameres, rel), 'wb').write(open(bak, 'rb').read())
        log('还原 %s' % rel)
    prev = os.path.join(gameres, PREV_REL)
    if os.path.isfile(prev):
        os.remove(prev)
        log('移除 ' + PREV_REL)


def status(gameres, patch_dir, log=print):
    man = open(os.path.join(gameres, 'manifest.ssra'), 'rb').read()
    lines = _etag_lines(os.path.join(gameres, ETAG_REL))
    log('etag 记录 hash=%s 与已装 manifest 匹配=%s' %
        (lines[2].decode(), lines[2] == str(xxhash.xxh64(man).intdigest()).encode()))
    log('分卷校验失败数=%d（缺卷为未安装目录，可忽略）' % Ssra(gameres).verify_present())


def main():
    import sys
    if len(sys.argv) < 3:
        print('用法: python ssra_zhcn.py <gameres目录> build|apply|restore|status')
        return
    gameres, cmd = sys.argv[1], sys.argv[2]
    patch = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'zhcn_patch')
    if cmd == 'build':
        build(gameres, patch)
    elif cmd == 'apply':
        apply(gameres, patch)
    elif cmd == 'restore':
        restore(gameres, patch)
    elif cmd == 'status':
        status(gameres, patch)
    else:
        print(__doc__)


if __name__ == '__main__':
    main()
