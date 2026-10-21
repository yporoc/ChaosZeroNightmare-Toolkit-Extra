#!/usr/bin/env python3
# ChaosZero Toolkit Extra
# Copyright (C) 2026 ChaosZero-Toolkit contributors
# GNU General Public License v3, see LICENSE.
"""ssra 版繁转简：官方 lang_zht 的 text/zht/text.db 转简体后重建分卷并应用。

原理（build 84 实测）：
  manifest.ssra 文件记录 = 40B[路径哈希,组内偏移,压缩/解压尺寸,...,压缩方法,组号]
  .ssrc 分卷 = 16B 对齐条目(zstd 帧或裸文件) + 16B footer['SSRC',卷号,XXH64(载荷)]
  text.db = PLPcK v1，值结构 '<id>\\0<文本>\\0'，.db 存储态带 256B 内层 XOR（相位逐文件固定）
  text.db 明文末尾可能还有一段官方页脚（build 84/88 为 0 字节，build 126 实测 38 字节且以
  'PLPcK' 魔数开头、内含条目数与桶数），重建时必须原样带回，否则解压尺寸与清单 dec 不符。
  启动器用 manifest.ssra.etag 里的 XXH64+size 校验本地 manifest，必须同步更新。
"""
import collections
import json
import os
import shutil
import struct

import xxhash
import zstandard as zstd
from opencc import OpenCC

from unpack_data import INNER_XOR_KEY

TEXT_DB = 'text/zht/text.db'
TARGET_PART = 'lang_zht_b03_0.ssrc'   # 历史卷名，仅用于提示；实际卷由清单决定
ETAG_REL = 'manifest.ssra.etag'
BACKUP_SUBDIR = 'backup_original'
IDENTITY_FILE = 'identity.json'


class ZhcnError(Exception):
    """前提不成立时的可执行停机：消息里必须说清"下一步该怎么办"。"""


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


def trailing_bytes(data, entries):
    """最后一个条目之后、明文结尾之前的原样字节（官方页脚，可能是 0 长度）。"""
    end = max((e[3] + 15 + len(e[0]) + len(e[1]) for e in entries), default=len(data))
    return data[end:]


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
    S, f, part_name, (part_idx, part_k, part_start, part_end) = locate_target(gameres)
    log('manifest build=%d parts=%d files=%d 目标 %s 在 %s' %
        (S.build, S.part_count, S.file_count, TEXT_DB, part_name))
    if part_name != TARGET_PART:
        log('提示: %s 现在 %s 卷里（历史卷名 %s），已按清单动态处理'
            % (TEXT_DB, part_name, TARGET_PART))
    if f['meth'] != 1:
        raise ZhcnError('%s 的压缩方法变成 meth=%d（不再是 zstd 帧），垫帧等长打法不适用；'
                        '要先搞清新的封装方式才能继续' % (TEXT_DB, f['meth']))
    if f['off'] + f['comp'] > part_end:
        raise ZhcnError('%s 跨了分卷边界（结束 %d > 卷内上界 %d），等长改写不成立；'
                        '这一版需要整组重建分卷，本工具暂未实现该路径'
                        % (TEXT_DB, f['off'] + f['comp'], part_end))
    part_path = os.path.join(S.chunk_dir, part_name)
    if not os.path.isfile(part_path):
        raise ZhcnError('分卷不在盘上：%s\n请先启动游戏把繁中资源下完，再做繁转简' % part_path)
    orig_part = open(part_path, 'rb').read()
    local = f['off'] - part_start
    if orig_part[local:local + 4] != b'\x28\xb5\x2f\xfd':
        raise ZhcnError('%s 在卷内偏移 %d 处不是 zstd 帧头（实得 %r），官方改了条目封装方式，'
                        '需要重新逆向' % (TEXT_DB, local, orig_part[local:local + 4]))
    gap = orig_part[local + f['comp']:len(orig_part) - 16]
    if gap.strip(b'\x00'):
        raise ZhcnError('%s 之后同一卷里还有别的条目（实测 %d 个非零字节），改它的长度会挤动后续条目；'
                        '这一版需要整组重建分卷，本工具暂未实现该路径'
                        % (TEXT_DB, len(gap.strip(b'\x00'))))

    enc = S.extract(TEXT_DB, decrypt=False)
    phase = _find_phase(enc[:64])
    if phase is None:
        raise ZhcnError('在 %s 明文头里找不到内层 XOR 相位（前 64 字节 %r），'
                        '官方改了 .db 的加密方式，需要重新逆向' % (TEXT_DB, enc[:16]))
    plain = _inner_decrypt(enc, phase)
    log('text.db 解密: phase=%d size=%d' % (phase, len(plain)))

    header, hash_count, buckets, entries = parse_textdb(plain)
    tail = trailing_bytes(plain, entries)
    # 自证：一条都不转的重建必须逐字节还原官方明文，否则后面所有产出都不可信
    assert rebuild_textdb(header, hash_count, buckets, entries, {}) + tail == plain, \
        '重建器无法逐字节还原官方 text.db，结构假设已失效'
    log('重建自证通过: 尾部原样字节 %d' % len(tail))
    stats = collections.Counter()
    new_values = convert_values(entries, stats)
    log('转换统计: %s' % dict(stats))
    newdb = rebuild_textdb(header, hash_count, buckets, entries, new_values) + tail
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
    if not new_values:
        log('官方 text.db 已全部为简体，无需转换（生成的补丁与官方内容一致）')

    # 分卷必须与官方逐字节同尺寸：CDN 上的分卷尺寸固定，任何按 manifest 尺寸
    # 发起的 Range 请求一旦超出官方 EOF 就会 HTTP 416 并死循环（实测 E22411）。
    # 因此帧压缩到不超过原始 comp 尺寸，再用标准 zstd skippable frame 垫满，
    # manifest 里只允许 XXH64 一个字段与官方不同。
    orig_comp, orig_dec = f['comp'], f['dec']
    if len(newdb) != orig_dec:
        grow = [i for i, v in new_values.items() if len(v) != len(entries[i][1])]
        raise ZhcnError('转换后 text.db 尺寸变了 %+d 字节（%d -> %d），其中 %d 条值的字节长度被 t2s 改动；'
                        '等长改写不成立，得先定新的填充策略' %
                        (len(newdb) - orig_dec, orig_dec, len(newdb), len(grow)))
    newdb_enc = _inner_decrypt(newdb, phase)
    # skippable frame 自己要占 8 字节头，所以余量只能是 0 或 >=8；
    # 1~7 字节属于"这一档压不出可用余量"，要换档而不是硬垫。
    frame = None
    tried = []
    for lvl in (3, 6, 9, 12, 16, 19):
        cand = zstd.ZstdCompressor(level=lvl).compress(newdb_enc)
        pad_total = orig_comp - len(cand)
        tried.append('%d:%+d' % (lvl, pad_total))
        if pad_total == 0 or pad_total >= 8:
            frame, pad_total = cand, pad_total
            break
    if frame is None:
        raise ZhcnError('简体内容压不进官方帧尺寸（各档余量 %s，需要 0 或 >=8 字节），'
                        '等长改写不成立，得整组重建分卷' % ' '.join(tried))
    if pad_total:
        n = pad_total - 8
        frame += b'\x50\x2a\x4d\x18' + struct.pack('<I', n) + b'\x00' * n
    assert len(frame) == orig_comp
    import io
    assert zstd.ZstdDecompressor().stream_reader(
        io.BytesIO(frame), read_across_frames=True).read() == newdb_enc, '垫帧回读不一致'

    payload = orig_part[:local] + frame + orig_part[local + orig_comp:len(orig_part) - 16]
    assert len(payload) == len(orig_part) - 16
    new_part = payload + b'SSRC' + struct.pack('<I', part_idx) + \
        struct.pack('<Q', xxhash.xxh64(payload).intdigest())
    assert len(new_part) == len(orig_part), '分卷尺寸与官方不一致'

    man_src = open(os.path.join(gameres, 'manifest.ssra'), 'rb').read()
    man = bytearray(man_src)
    o = 0x40 + part_k * 32
    old_a, old_b = struct.unpack_from('<QQ', man, o + 8)
    assert (len(new_part) - 16, len(new_part)) == (old_a, old_b), '分卷尺寸字段意外变化'
    struct.pack_into('<Q', man, o + 24, _xxh(new_part[:-16]))
    man = bytes(man)

    os.makedirs(out_dir, exist_ok=True)
    open(os.path.join(out_dir, 'manifest.ssra'), 'wb').write(man)
    open(os.path.join(out_dir, part_name), 'wb').write(new_part)
    ident = {
        'build': S.build,
        'context': patch_context(gameres),
        'part': part_name,
        'official': {'manifest': _xxh(man_src), 'manifest_size': len(man_src),
                     'part': _xxh(orig_part[:-16]), 'part_size': len(orig_part)},
        'patched': {'manifest': _xxh(man), 'manifest_size': len(man),
                    'part': _xxh(new_part[:-16]), 'part_size': len(new_part)},
        'text_db': {'comp': orig_comp, 'dec': orig_dec, 'entries': len(entries),
                    'converted': len(new_values), 'tail': len(tail), 'phase': phase},
    }
    json.dump(ident, open(os.path.join(out_dir, IDENTITY_FILE), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    log('补丁已生成: manifest.ssra(%d) %s(%d) 身份 build=%s 卷哈希 %s -> %s' %
        (len(man), part_name, len(new_part), S.build,
         ident['official']['part'], ident['patched']['part']))
    return os.path.join(out_dir, 'manifest.ssra'), os.path.join(out_dir, part_name)


def _etag_lines(path):
    return open(path, 'rb').read().split(b'\r\n')


def _xxh(b):
    return xxhash.xxh64(b).intdigest()


def _bak_name(rel):
    return rel.replace('\\', '__').replace('/', '__') + '.bak'


def patch_context(gameres):
    p = os.path.join(gameres, 'patch-complete.json')
    if not os.path.isfile(p):
        return ''
    return json.loads(open(p, 'rb').read()).get('context', '')


def live_identity(gameres):
    """现场资源树的身份：清单哈希/尺寸 + build（清单头里的 build_number）。"""
    man = open(os.path.join(gameres, 'manifest.ssra'), 'rb').read()
    return {'manifest': _xxh(man), 'manifest_size': len(man),
            'build': struct.unpack_from('<I', man, 8)[0],
            'context': patch_context(gameres)}


def live_part_identity(gameres, part):
    p = os.path.join(gameres, 'chunks', part)
    if not os.path.isfile(p):
        raise ZhcnError('分卷不在盘上：%s\n请先启动游戏把繁中资源下完，再做繁转简' % p)
    d = open(p, 'rb').read()
    return {'part': _xxh(d[:-16]), 'part_size': len(d)}


def backup_tag(ident):
    ctx = ident.get('context') or 'nocontext'
    safe = ''.join(c if (c.isalnum() or c in '._-') else '_' for c in ctx)
    return 'b%s-%s' % (ident['build'], safe)


def load_identity(patch_dir):
    p = os.path.join(patch_dir, IDENTITY_FILE) if patch_dir else ''
    if not p or not os.path.isfile(p):
        return None
    d = json.loads(open(p, 'rb').read())
    for k in ('build', 'part', 'official', 'patched'):
        if k not in d:
            raise ZhcnError('%s 缺少字段 %r，身份记录不完整' % (p, k))
    return d


def require_identity(patch_dir):
    ident = load_identity(patch_dir)
    if ident is None:
        raise ZhcnError('补丁目录缺少 %s，无法核对版本身份\n请用当前版本重新构建补丁' % IDENTITY_FILE)
    return ident


def locate_target(gameres):
    """按清单定位 (Ssra, 文件记录, 卷名, (卷序号, 卷表下标, 卷内起点, 卷内终点))。

    卷名与偏移一律由清单推导，不做硬编码。
    """
    S = Ssra(gameres)
    f = S.record(TEXT_DB)
    spans = [(idx, k, s, e) for idx, k, s, e in S.gcum[f['grp']][1] if s <= f['off'] < e]
    if len(spans) != 1:
        raise ZhcnError('%s 的起点落在 %d 个分卷里，无法定位' % (TEXT_DB, len(spans)))
    return S, f, S.part_names[spans[0][1]], spans[0]


STATE_MISSING = '资源未就绪'
STATE_UNKNOWN = '未判定'
STATE_OFFICIAL = '未汉化'
STATE_PATCHED = '已汉化'
STATE_STALE = '汉化失效'
STATE_FOREIGN = '现场异常'


def classify(gameres, patch_dir=None, deep=False, log=print):
    """现场汉化状态，返回 (状态, 说明)。

    快路只读清单头 + 身份记录（几十毫秒，可以待在 UI 线程里）；
    deep=True 才真的解压 text.db 去数残留繁体条数——那要碰 22MB 和 OpenCC，
    只能放后台线程，所以默认不做。
    """
    if not os.path.isfile(os.path.join(gameres, 'manifest.ssra')):
        return STATE_MISSING, '没有 manifest.ssra，资源未就绪或路径不对'
    try:
        S, f, part, span = locate_target(gameres)
    except (KeyError, ZhcnError, AssertionError) as e:
        return STATE_FOREIGN, '清单里找不到 %s：%s' % (TEXT_DB, e)
    if not os.path.isfile(os.path.join(gameres, 'chunks', part)):
        return STATE_MISSING, '分卷 %s 不在盘上，请先让游戏下完繁中资源' % part
    live = live_identity(gameres)
    ident = load_identity(patch_dir)
    if ident:
        off, pat = ident['official'], ident['patched']
        if part != ident['part']:
            return STATE_STALE, ('%s 现在在 %s 卷里，补丁记录的是 %s——官方把繁中文本挪了卷，'
                                 '重新点一次繁转简即可' % (TEXT_DB, part, ident['part']))
        lp = live_part_identity(gameres, part)
        man_off = (live['manifest'], live['manifest_size']) == (off['manifest'], off['manifest_size'])
        man_pat = (live['manifest'], live['manifest_size']) == (pat['manifest'], pat['manifest_size'])
        part_off = (lp['part'], lp['part_size']) == (off['part'], off['part_size'])
        part_pat = (lp['part'], lp['part_size']) == (pat['part'], pat['part_size'])
        if man_pat and part_pat:
            n = ident.get('text_db', {}).get('converted')
            return STATE_PATCHED, '已汉化（build %s，%s 条已转简，清单与分卷身份都对得上）' % (
                live['build'], n)
        if man_off and part_off:
            return STATE_OFFICIAL, '官方态（build %s），还没汉化' % live['build']
        if ident['build'] != live['build']:
            return STATE_STALE, ('补丁是给 build %s 做的，现场已是 build %s——资源更新把汉化冲掉了，'
                                 '重新点一次繁转简即可' % (ident['build'], live['build']))
        if man_off and part_pat:
            return STATE_FOREIGN, '清单是官方态但分卷还是补丁件（%s）——按"重新繁转简"可自动纠正' % part
        if man_pat and part_off:
            return STATE_FOREIGN, '清单还是补丁件但分卷已被换回官方（%s）——汉化实际已失效' % part
        return STATE_FOREIGN, '现场清单/分卷与补丁记录都不符，请先让游戏更新一轮资源再重建补丁'
    if not deep:
        return STATE_UNKNOWN, 'build %s，本目录还没有补丁身份记录，无法只凭清单判定' % live['build']
    try:
        plain = S.extract(TEXT_DB)
        entries = parse_textdb(plain)[3]
    except (ZhcnError, AssertionError) as e:
        return STATE_FOREIGN, '读 %s 失败：%s' % (TEXT_DB, e)
    n = len(convert_values(entries, collections.Counter()))
    if n == 0:
        return STATE_PATCHED, 'build %s，文本已无繁体残留（%d 条）' % (live['build'], len(entries))
    return STATE_OFFICIAL, 'build %s，还有 %d 条是繁体待转简' % (live['build'], n)


def sync_identity(gameres, log=print):
    """把 etag 身份记录(XXH64+size)同步为当前 manifest。

    只动 etag 的第 3/4 行。manifest.ssra.prev 是更新器自己维护的"上一版清单"，
    我们既不写也不删——盖上去会让更新器的差分合成拿到一个假基线。
    """
    man_path = os.path.join(gameres, 'manifest.ssra')
    man = open(man_path, 'rb').read()
    etag = os.path.join(gameres, ETAG_REL)
    lines = _etag_lines(etag)
    lines[2] = str(xxhash.xxh64(man).intdigest()).encode()
    lines[3] = str(len(man)).encode()
    open(etag, 'wb').write(b'\r\n'.join(lines))
    log('身份记录已同步: hash=%s size=%s' % (lines[2].decode(), lines[3].decode()))


def apply(gameres, patch_dir, log=print):
    """按身份应用补丁：现场必须与补丁记录的官方态逐字节对得上，否则拒绝。

    备份按 build+context 分子目录，并且每次都用已核实为官方态的现场重写——
    这样就不可能再把"已打过补丁的卷"存成"原件"（历史上三份脏原件就是这么来的）。
    """
    ident = require_identity(patch_dir)
    part = ident['part']
    pfile = os.path.join(patch_dir, part)
    if not os.path.isfile(pfile):
        raise ZhcnError('补丁目录里缺分卷 %s，补丁不完整\n请重新构建补丁' % pfile)
    live = live_identity(gameres)
    if live['build'] != ident['build']:
        raise ZhcnError('现场是 build %s，这个补丁是给 build %s 做的\n请重新构建补丁'
                        % (live['build'], ident['build']))
    off, pat = ident['official'], ident['patched']
    if (live['manifest'], live['manifest_size']) == (pat['manifest'], pat['manifest_size']):
        log('现场已经是这个补丁的结果（build %s），无需重复应用' % live['build'])
        return
    if (live['manifest'], live['manifest_size']) != (off['manifest'], off['manifest_size']):
        raise ZhcnError('现场清单与补丁记录的官方清单不符：现场 %s/%d，记录 %s/%d\n'
                        '多半是游戏又更新了，请重新构建补丁再应用'
                        % (live['manifest'], live['manifest_size'],
                           off['manifest'], off['manifest_size']))
    lp = live_part_identity(gameres, part)
    if (lp['part'], lp['part_size']) != (off['part'], off['part_size']):
        raise ZhcnError('现场分卷 %s 不是补丁记录的那个官方件：现场 %s/%d，记录 %s/%d\n'
                        '拒绝备份，否则会把非官方卷当成"原件"存下来'
                        % (part, lp['part'], lp['part_size'], off['part'], off['part_size']))
    bd = os.path.join(patch_dir, BACKUP_SUBDIR, backup_tag(ident))
    os.makedirs(bd, exist_ok=True)
    for rel in ('manifest.ssra', os.path.join('chunks', part), ETAG_REL):
        src = os.path.join(gameres, rel)
        if not os.path.isfile(src):
            raise ZhcnError('要备份的文件不存在：%s' % src)
        open(os.path.join(bd, _bak_name(rel)), 'wb').write(open(src, 'rb').read())
        log('备份 %s -> %s' % (rel, os.path.join(bd, _bak_name(rel))))
    json.dump(ident, open(os.path.join(bd, IDENTITY_FILE), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    for rel, src in (('manifest.ssra', os.path.join(patch_dir, 'manifest.ssra')),
                     (os.path.join('chunks', part), pfile)):
        open(os.path.join(gameres, rel), 'wb').write(open(src, 'rb').read())
        log('应用 %s' % rel)
    after = live_identity(gameres)
    ap = live_part_identity(gameres, part)
    if (after['manifest'], after['manifest_size'], ap['part'], ap['part_size']) != (
            pat['manifest'], pat['manifest_size'], pat['part'], pat['part_size']):
        raise ZhcnError('应用后回读身份与补丁记录不符，现场可能没写成功：现场清单 %s/%d，记录 %s/%d'
                        % (after['manifest'], after['manifest_size'],
                           pat['manifest'], pat['manifest_size']))
    log('应用后身份核对通过: build=%s 卷=%s' % (after['build'], part))
    sync_identity(gameres, log)


def restore(gameres, patch_dir, log=print):
    """只还原"现场能对上身份"的那一份备份，对不上就拒绝写。"""
    broot = os.path.join(patch_dir, BACKUP_SUBDIR)
    if not os.path.isdir(broot):
        raise ZhcnError('没有备份目录 %s，无法还原' % broot)
    idents = {}
    for tag in sorted(os.listdir(broot)):
        p = os.path.join(broot, tag, IDENTITY_FILE)
        if os.path.isfile(p):
            idents[tag] = json.loads(open(p, 'rb').read())
    if not idents:
        raise ZhcnError('备份目录 %s 里没有带版本身份的备份（旧版备份不含身份，不敢拿来还原）\n'
                        '要回官方态，最稳的是让游戏自己更新一轮资源' % broot)
    live = live_identity(gameres)
    chosen = None
    for tag, ident in idents.items():
        pat, off = ident['patched'], ident['official']
        if (live['manifest'], live['manifest_size'], live['build']) == (
                pat['manifest'], pat['manifest_size'], ident['build']):
            chosen = (tag, ident)
            break
        if (live['manifest'], live['manifest_size'], live['build']) == (
                off['manifest'], off['manifest_size'], ident['build']):
            log('现场已是 build %s 的官方态，无需还原' % live['build'])
            return
    if chosen is None:
        raise ZhcnError('现场清单（build %s, %s/%d）与任何一份带身份的备份都对不上，拒绝写入。\n'
                        '备份里有: %s' % (live['build'], live['manifest'], live['manifest_size'],
                                          sorted(idents)))
    tag, ident = chosen
    bd = os.path.join(broot, tag)
    part = ident['part']
    off = ident['official']
    for rel in ('manifest.ssra', os.path.join('chunks', part), ETAG_REL):
        bak = os.path.join(bd, _bak_name(rel))
        if not os.path.isfile(bak):
            raise ZhcnError('备份缺文件 %s' % bak)
        open(os.path.join(gameres, rel), 'wb').write(open(bak, 'rb').read())
        log('还原 %s' % rel)
    after = live_identity(gameres)
    ap = live_part_identity(gameres, part)
    if (after['manifest'], after['manifest_size'], ap['part'], ap['part_size']) != (
            off['manifest'], off['manifest_size'], off['part'], off['part_size']):
        raise ZhcnError('还原后身份与官方记录不符，请人工检查 %s：现场清单 %s/%d，官方记录 %s/%d'
                        % (bd, after['manifest'], after['manifest_size'],
                           off['manifest'], off['manifest_size']))
    log('还原后身份核对通过: build=%s 卷=%s' % (after['build'], part))


def official_input_tree(gameres, patch_dir, workdir, log=print):
    """现场不是官方态时，用本工具自己留下的、且被身份记录核实过的备份铺一棵官方态输入树。

    铺不出来就返回 None（自检会直接说明前提不成立，绝不拿脏件当官方态跑分）。
    """
    broot = os.path.join(patch_dir, BACKUP_SUBDIR) if patch_dir else ''
    if not os.path.isdir(broot):
        return None
    live = live_identity(gameres)
    for tag in sorted(os.listdir(broot), reverse=False):
        p = os.path.join(broot, tag, IDENTITY_FILE)
        if not os.path.isfile(p):
            continue
        ident = json.loads(open(p, 'rb').read())
        if ident['build'] != live['build']:
            continue
        pat = ident['patched']
        if (live['manifest'], live['manifest_size']) != (pat['manifest'], pat['manifest_size']):
            continue          # 现场连补丁态都不是 ⇒ 不是"已汉化"，不值得铺
        part = ident['part']
        bak_man = os.path.join(broot, tag, _bak_name('manifest.ssra'))
        bak_part = os.path.join(broot, tag, _bak_name(os.path.join('chunks', part)))
        bak_etag = os.path.join(broot, tag, _bak_name(ETAG_REL))
        if not (os.path.isfile(bak_man) and os.path.isfile(bak_part)):
            continue
        d = os.path.join(workdir, 'official_input')
        shutil.rmtree(d, ignore_errors=True)
        os.makedirs(os.path.join(d, 'chunks'))
        man = open(bak_man, 'rb').read()
        prt = open(bak_part, 'rb').read()
        # 备份里存的必须正是身份记录所说的官方件，否则不给用
        if (_xxh(man), len(man), _xxh(prt[:-16]), len(prt)) != (
                ident['official']['manifest'], ident['official']['manifest_size'],
                ident['official']['part'], ident['official']['part_size']):
            log('备份 %s 与身份记录不符，不拿来当官方态输入' % tag)
            continue
        open(os.path.join(d, 'manifest.ssra'), 'wb').write(man)
        open(os.path.join(d, 'chunks', part), 'wb').write(prt)
        if os.path.isfile(bak_etag):
            open(os.path.join(d, ETAG_REL), 'wb').write(open(bak_etag, 'rb').read())
        for extra in ('patch-complete.json', 'manifest.ssra.prev'):
            src = os.path.join(gameres, extra)
            if os.path.isfile(src):
                shutil.copyfile(src, os.path.join(d, extra))
        log('现场已是汉化态，改用备份 %s 铺出的官方态输入做自检：%s' % (tag, d))
        return d, ident
    return None


def selftest(gameres, workdir, patch_dir=None, log=print):
    """无头自检：产出补丁并把它读回来验，全程不写游戏目录。

    返回 [(判据名, 是否通过, 证据), ...]。每条都是"读产物/读现场"得出的，
    不是"没抛异常"就算过。
    """
    res = []

    def chk(name, ok, evi=''):
        res.append((name, bool(ok), str(evi)))
        log('%-4s %s %s' % ('PASS' if ok else 'FAIL', name, evi))

    S, f, part, (part_idx, part_k, part_start, part_end) = locate_target(gameres)
    chk('G1 清单定位目标', True, 'build=%s files=%d 卷=%s off=%d comp=%d dec=%d' %
        (S.build, S.file_count, part, f['off'], f['comp'], f['dec']))
    man_live = open(os.path.join(gameres, 'manifest.ssra'), 'rb').read()
    d = os.path.join(gameres, 'chunks', part)
    if not os.path.isfile(d):
        chk('G2 目标分卷在盘', False, d)
        return res
    part_live = open(d, 'rb').read()
    live_part_hash = _xxh(part_live[:-16])
    rec_hash = [p[5] for p in S.parts if p[2] == part_k][0]
    chk('G2 目标分卷在盘且哈希与清单记录一致', live_part_hash == rec_hash,
        'disk=%d 记录=%s 实=%s（不一致=现场已是补丁态或被人改过）' % (len(part_live), rec_hash,
                                                                       live_part_hash))
    used_backup = None
    shutil.rmtree(workdir, ignore_errors=True)
    os.makedirs(workdir, exist_ok=True)
    plain_off = S.extract(TEXT_DB)
    entries_off = parse_textdb(plain_off)[3]
    tail_off = trailing_bytes(plain_off, entries_off)
    if not convert_values(entries_off, collections.Counter()):
        # 现场没繁体可转：多半是已经汉化过。改用它自己的已核实备份铺官方态输入。
        got = official_input_tree(gameres, patch_dir, workdir, log)
        if not got:
            chk('G0 自检输入必须有繁体可转', False,
                '现场 %s 已无繁体可转（多半是已经汉化过）；请在官方态资源上跑，或先还原再自检' % TEXT_DB)
            return res
        used_backup, ident_live = got
        S, f, part, (part_idx, part_k, part_start, part_end) = locate_target(used_backup)
        gameres = used_backup
        man_live = open(os.path.join(gameres, 'manifest.ssra'), 'rb').read()
        part_live = open(os.path.join(gameres, 'chunks', part), 'rb').read()
        plain_off = S.extract(TEXT_DB)
        entries_off = parse_textdb(plain_off)[3]
        tail_off = trailing_bytes(plain_off, entries_off)
        chk('G0 备份铺出的官方态输入可用',
            (_xxh(man_live), len(man_live), _xxh(part_live[:-16]), len(part_live)) ==
            (ident_live['official']['manifest'], ident_live['official']['manifest_size'],
             ident_live['official']['part'], ident_live['official']['part_size']),
            'build=%s 官方卷=%s' % (S.build, ident_live['official']['part']))
    out = os.path.join(workdir, 'patch')
    build(gameres, out, log=lambda m: log('      ' + str(m)))
    pf = os.path.join(out, part)
    part_new = open(pf, 'rb').read()
    chk('G3 产物分卷与官方等长', len(part_new) == len(part_live),
        '%d vs %d' % (len(part_new), len(part_live)))
    man_new = open(os.path.join(out, 'manifest.ssra'), 'rb').read()
    diff = [i for i in range(len(man_new)) if man_new[i] != man_live[i]]
    fld = list(range(0x40 + part_k * 32 + 24, 0x40 + part_k * 32 + 32))
    chk('G4 清单只差该卷 XXH64 一处', diff and set(diff) <= set(fld),
        '差异 %d 字节，位置=%s，允许=%s' % (len(diff), diff[:4], fld[0]))
    ident = require_identity(out)
    chk('G5 身份记录与产物实测一致',
        (ident['patched']['part'], ident['patched']['part_size'], ident['official']['part']) ==
        (_xxh(part_new[:-16]), len(part_new), _xxh(part_live[:-16])),
        'build=%s 官方卷=%s 补丁卷=%s' % (ident['build'], ident['official']['part'],
                                          ident['patched']['part']))

    # 回环：用候选清单 + 候选卷搭一棵只读树，按真读者的路径读回来
    rt = os.path.join(workdir, 'roundtrip')
    os.makedirs(os.path.join(rt, 'chunks'))
    shutil.copyfile(os.path.join(out, 'manifest.ssra'), os.path.join(rt, 'manifest.ssra'))
    shutil.copyfile(pf, os.path.join(rt, 'chunks', part))
    S2 = Ssra(rt)
    plain_new = S2.extract(TEXT_DB)
    entries_new = parse_textdb(plain_new)[3]
    tail_new = trailing_bytes(plain_new, entries_new)
    chk('G6 候选卷能被真读者解析', len(plain_new) == f['dec'] and plain_new[:5] == b'PLPcK',
        '解压=%d dec=%d' % (len(plain_new), f['dec']))
    n_trad = len(convert_values(entries_new, collections.Counter()))
    chk('G7 回读后繁体残留为 0', n_trad == 0, '残留=%d' % n_trad)
    chk('G8 条目数与键集不变',
        len(entries_new) == len(entries_off) and
        {e[0] for e in entries_new} == {e[0] for e in entries_off},
        '官方=%d 回读=%d' % (len(entries_off), len(entries_new)))
    chk('G9 尾部页脚原样带回', tail_new == tail_off and len(tail_new) == len(tail_off),
        '官方尾=%d 回读尾=%d' % (len(tail_off), len(tail_new)))
    expect = convert_values(entries_off, collections.Counter())
    exp_by_key = {entries_off[i][0]: v for i, v in expect.items()}
    off_by_key = {e[0]: e[1] for e in entries_off}
    new_by_key = {e[0]: e[1] for e in entries_new}
    wrong = [k[:32] for k, v in new_by_key.items() if v != exp_by_key.get(k, off_by_key[k])]
    chk('G10 逐条值对账（转过的等于转换结果，没转的一字未改）',
        not wrong and len(new_by_key) == len(entries_off),
        '不符=%d %s 期望改动=%d 键数=%d/%d' % (len(wrong), wrong[:2], len(expect),
                                                len(new_by_key), len(entries_off)))
    import io
    local = f['off'] - part_start
    enc_off = S.extract(TEXT_DB, decrypt=False)
    phase = _find_phase(enc_off[:64])
    got = zstd.ZstdDecompressor().stream_reader(
        io.BytesIO(part_new[local:local + f['comp']]), read_across_frames=True).read()
    want = _inner_decrypt(plain_new, phase)
    chk('G11 候选帧可整帧流式回读成候选明文', got == want,
        'phase=%s got=%d want=%d' % (phase, len(got), len(want)))
    if used_backup:
        # 三方对账：本次由官方件重建的补丁 == 现场正在用的补丁 == 身份记录所说的补丁
        chk('G12 重建补丁与现场在用补丁同哈希',
            _xxh(part_new[:-16]) == live_part_hash == ident_live['patched']['part'],
            '重建=%s 现场=%s 记录=%s' % (_xxh(part_new[:-16]), live_part_hash,
                                          ident_live['patched']['part']))
    shutil.rmtree(workdir, ignore_errors=True)
    return res


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
