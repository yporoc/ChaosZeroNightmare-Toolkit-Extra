# ChaosZero Toolkit Extra
# Copyright (C) 2026 ChaosZero-Toolkit contributors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

"""
Rebuild the JavaScript fallback bundle embedded in the game executable.

游戏 exe 内部带有一份 JS fallback 资源（PE 资源 type=242 name=241，逐字节 XOR 0x5A
加密，前缀为少量原始数据 + 一个 ZIP 包）。ZIP 中 pre/javascript/*.js 为引擎脚本，
pre/bin/*/init.jbin 为字节码缓存。本模块用工具目录中的脚本替换前者并清空后者，
重建出与原资源完全等长的 ZIP 后写回 exe 副本（定长填充使用 archive comment 或
pre/dummy_padding.bin）。
"""
import hashlib
import io
import os
import shutil
import zipfile

import pefile

RESOURCE_TYPE_ID = 242
RESOURCE_NAME_ID = 241
RESOURCE_XOR = 90
ZIP_MAGIC = b'PK\x03\x04'
ZIP_PREFIX_SCAN_SIZE = 4096
PADDING_NAME = 'pre/dummy_padding.bin'

REQUIRED_JS_FILES = (
    'bgani.js',
    'boot.js',
    'bootres.js',
    'cheat.js',
    'entry_util.js',
    'init.js',
    'pre_data.js',
    'publisher_base.js',
    'publisher_stove.js',
    'publisher_xcent.js',
    'resolution.js',
    'title_popups.js',
    'title.js',
    'ttfwork.js',
    'util.js',
    'work_dynamic_atlas.js',
    'work_font_atlas.js',
)

# 各脚本在 fallback 包中的原始格式: (换行符, 是否带 BOM, 末尾换行数)
JS_FILE_FORMATS = {
    'bgani.js': ('\r\n', True, 0),
    'boot.js': ('\r\n', False, 2),
    'bootres.js': ('\r\n', True, 1),
    'cheat.js': ('\r\n', False, 1),
    'entry_util.js': ('\r\n', False, 0),
    'init.js': ('\r\n', False, 1),
    'pre_data.js': ('\r\n', False, 0),
    'publisher_base.js': ('\r\n', False, 0),
    'publisher_stove.js': ('\r\n', False, 0),
    'publisher_xcent.js': ('\r\n', False, 0),
    'resolution.js': ('\n', False, 1),
    'title_popups.js': ('\r\n', True, 0),
    'title.js': ('\r\n', True, 0),
    'ttfwork.js': ('\r\n', False, 2),
    'util.js': ('\r\n', False, 0),
    'work_dynamic_atlas.js': ('\r\n', False, 2),
    'work_font_atlas.js': ('\r\n', False, 2),
}


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1048576), b''):
            digest.update(chunk)
    return digest.hexdigest().upper()


def _xor_resource(data):
    table = bytes(value ^ RESOURCE_XOR for value in range(256))
    return data.translate(table)


def _resource_identifier(entry):
    if getattr(entry, 'name', None) is not None:
        return str(entry.name)
    return getattr(entry, 'id', None)


def _walk_resources(directory, path=()):
    for entry in directory.entries:
        entry_path = path + (_resource_identifier(entry),)
        if hasattr(entry, 'directory'):
            yield from _walk_resources(entry.directory, entry_path)
        elif hasattr(entry, 'data'):
            yield entry_path, entry.data


def _load_resource(pe, resource_path, resource_data):
    rva = resource_data.struct.OffsetToData
    size = resource_data.struct.Size
    offset = pe.get_physical_by_rva(rva)
    encrypted = pe.get_data(rva, size)
    decrypted = _xor_resource(encrypted)
    zip_offset = decrypted[:ZIP_PREFIX_SCAN_SIZE].find(ZIP_MAGIC)
    if zip_offset < 0:
        return None
    try:
        with zipfile.ZipFile(io.BytesIO(decrypted[zip_offset:]), 'r') as archive:
            archive.infolist()
    except (OSError, zipfile.BadZipFile):
        return None
    return {
        'resource_path': resource_path,
        'resource_offset': offset,
        'resource_size': size,
        'encrypted': encrypted,
        'decrypted': decrypted,
        'zip_offset': zip_offset,
    }


def find_embedded_resource(exe_path):
    pe = pefile.PE(exe_path, fast_load=True)
    pe.parse_data_directories(
        directories=[pefile.DIRECTORY_ENTRY['IMAGE_DIRECTORY_ENTRY_RESOURCE']]
    )
    try:
        if not hasattr(pe, 'DIRECTORY_ENTRY_RESOURCE'):
            raise RuntimeError('PE 文件没有资源目录')
        resources = list(_walk_resources(pe.DIRECTORY_ENTRY_RESOURCE))
        preferred = []
        fallback = []
        for resource_path, resource_data in resources:
            if resource_path[:2] == (RESOURCE_TYPE_ID, RESOURCE_NAME_ID):
                preferred.append((resource_path, resource_data))
            else:
                fallback.append((resource_path, resource_data))
        for resource_path, resource_data in preferred + fallback:
            candidate = _load_resource(pe, resource_path, resource_data)
            if candidate is None:
                continue
            return candidate
        raise RuntimeError(
            f'找不到可识别的内嵌资源 {RESOURCE_TYPE_ID}/{RESOURCE_NAME_ID}'
            f'（XOR 0x{RESOURCE_XOR:02X} + ZIP）'
        )
    finally:
        pe.close()


def missing_js_files(js_dir, init_path=None):
    if not os.path.isdir(js_dir):
        return list(REQUIRED_JS_FILES)
    available = {
        name.lower(): os.path.join(js_dir, name)
        for name in os.listdir(js_dir)
        if os.path.isfile(os.path.join(js_dir, name))
    }
    missing = []
    for name in REQUIRED_JS_FILES:
        if name == 'init.js' and init_path:
            path = init_path
        else:
            path = available.get(name.lower())
        if path and os.path.isfile(path):
            continue
        missing.append(name)
    return missing


def _prepare_init(data, toolkit_dir):
    if not toolkit_dir or b'__TOOLKIT_DIR__' not in data:
        return data, 0
    try:
        text = data.decode('utf-8-sig')
    except UnicodeDecodeError as exc:
        raise RuntimeError(f'init.js 不是有效的 UTF-8 文件: {exc}') from exc
    normalized_dir = os.path.abspath(toolkit_dir).replace('\\', '/').rstrip('/') + '/'
    normalized_dir = normalized_dir.replace("'", "\\'")
    replacements = text.count('__TOOLKIT_DIR__')
    return text.replace('__TOOLKIT_DIR__', normalized_dir).encode('utf-8'), replacements


def _restore_source_format(name, data):
    newline, use_bom, trailing_newlines = JS_FILE_FORMATS[name]
    try:
        text = data.decode('utf-8-sig')
    except UnicodeDecodeError as exc:
        raise RuntimeError(f'{name} 不是有效的 UTF-8 文件: {exc}') from exc
    text = text.replace('\r\n', '\n').replace('\r', '\n').rstrip('\n')
    text = text.replace('\n', newline) + newline * trailing_newlines
    encoded = text.encode('utf-8')
    if use_bom:
        return b'\xef\xbb\xbf' + encoded
    return encoded


def collect_js_files(js_dir, init_path=None, toolkit_dir=None):
    missing = missing_js_files(js_dir, init_path)
    if missing:
        raise FileNotFoundError('缺少注入脚本: ' + ', '.join(missing))
    available = {
        name.lower(): os.path.join(js_dir, name)
        for name in os.listdir(js_dir)
        if os.path.isfile(os.path.join(js_dir, name))
    }
    injected = []
    placeholder_replacements = 0
    for name in REQUIRED_JS_FILES:
        if name == 'init.js' and init_path:
            path = init_path
        else:
            path = available[name.lower()]
        with open(path, 'rb') as stream:
            data = stream.read()
        data = _restore_source_format(name, data)
        if name == 'init.js':
            data, placeholder_replacements = _prepare_init(data, toolkit_dir)
        injected.append((f'pre/javascript/{name}', data))
    return injected, placeholder_replacements


def _safe_zip_time(date_time):
    year, month, day, hour, minute, second = date_time
    return (
        max(1980, min(2107, year or 1980)),
        month if 1 <= month <= 12 else 1,
        day if 1 <= day <= 31 else 1,
        hour if 0 <= hour <= 23 else 0,
        minute if 0 <= minute <= 59 else 0,
        second if 0 <= second <= 59 else 0,
    )


def _copy_zip_info(source):
    target = zipfile.ZipInfo(
        source.filename, date_time=_safe_zip_time(source.date_time)
    )
    target.compress_type = zipfile.ZIP_STORED
    target.comment = source.comment
    target.extra = source.extra
    target.create_system = source.create_system
    target.create_version = source.create_version
    target.extract_version = source.extract_version
    target.internal_attr = source.internal_attr
    target.external_attr = source.external_attr
    return target


def _make_zip(entries, injected, archive_comment=None, dummy_size=None):
    output = io.BytesIO()
    with zipfile.ZipFile(
        output, 'w', compression=zipfile.ZIP_STORED, allowZip64=True
    ) as archive:
        for old_info, data in entries:
            archive.writestr(_copy_zip_info(old_info), data)
        for name, data in injected:
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_STORED
            archive.writestr(info, data)
        if dummy_size is not None:
            info = zipfile.ZipInfo(PADDING_NAME, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_STORED
            archive.writestr(info, b'\x00' * dummy_size)
        archive.comment = archive_comment
    return output.getvalue()


def rebuild_same_size_zip(zip_bytes, injected):
    target_size = len(zip_bytes)
    with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as source:
        original_infos = source.infolist()
        original_comment = source.comment
        entries = []
        cleared_jbin = 0
        dropped_js = 0
        dropped_dummy = 0
        for info in original_infos:
            lower_name = info.filename.lower()
            if lower_name == PADDING_NAME.lower():
                dropped_dummy += 1
                continue
            if lower_name.startswith('pre/javascript/') and lower_name.endswith('.js'):
                dropped_js += 1
                continue
            data = source.read(info)
            if lower_name.startswith('pre/bin/') and lower_name.endswith('/init.jbin'):
                data = b''
                cleared_jbin += 1
            entries.append((info, data))
    if cleared_jbin == 0:
        raise RuntimeError('内嵌 ZIP 中没有找到 pre/bin/*/init.jbin')
    base_zip = _make_zip(entries, injected, archive_comment=original_comment)
    size_difference = target_size - len(base_zip)
    if size_difference < 0:
        raise RuntimeError(
            f'注入后的 ZIP 超出原资源容量 {-size_difference:,} 字节'
        )
    final_zip = None
    dummy_size = 0
    if size_difference == 0:
        final_zip = base_zip
    elif len(original_comment) + size_difference <= 65535:
        final_zip = _make_zip(
            entries,
            injected,
            archive_comment=original_comment + b'\x00' * size_difference,
        )
    else:
        empty_dummy_zip = _make_zip(
            entries, injected, archive_comment=original_comment, dummy_size=0
        )
        dummy_overhead = len(empty_dummy_zip) - len(base_zip)
        dummy_size = size_difference - dummy_overhead
        if dummy_size < 0:
            raise RuntimeError('剩余空间不足以创建定长填充项')
        final_zip = _make_zip(
            entries,
            injected,
            archive_comment=original_comment,
            dummy_size=dummy_size,
        )
    if len(final_zip) != target_size:
        raise RuntimeError(
            f'定长重建失败: 原大小 {target_size:,}，新大小 {len(final_zip):,}'
        )
    with zipfile.ZipFile(io.BytesIO(final_zip), 'r') as check:
        bad_file = check.testzip()
        names = {info.filename.lower(): info for info in check.infolist()}
        for name in REQUIRED_JS_FILES:
            if f'pre/javascript/{name}'.lower() not in names:
                raise RuntimeError(f'重建校验缺少 pre/javascript/{name}')
        init_jbins = [
            info
            for info in check.infolist()
            if info.filename.lower().startswith('pre/bin/')
            and info.filename.lower().endswith('/init.jbin')
        ]
        new_entry_count = len(check.infolist())
    if bad_file or not init_jbins or any(info.file_size for info in init_jbins):
        raise RuntimeError(f'重建 ZIP 校验失败: {bad_file or "init.jbin 未清空"}')
    return final_zip, {
        'old_entries': len(original_infos),
        'new_entries': new_entry_count,
        'cleared_jbin': cleared_jbin,
        'dropped_js': dropped_js,
        'dropped_dummy': dropped_dummy,
        'dummy_size': dummy_size,
    }


def inspect_exe(exe_path):
    resource = find_embedded_resource(exe_path)
    zip_bytes = resource['decrypted'][resource['zip_offset']:]
    with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as archive:
        bad_file = archive.testzip()
        infos = archive.infolist()
        names = {info.filename.lower(): info for info in infos}
        init_jbins = [
            info
            for info in infos
            if info.filename.lower().startswith('pre/bin/')
            and info.filename.lower().endswith('/init.jbin')
        ]
        injected_count = sum(
            1
            for name in REQUIRED_JS_FILES
            if f'pre/javascript/{name}'.lower() in names
        )
        patched = (
            bad_file is None
            and injected_count == len(REQUIRED_JS_FILES)
            and bool(init_jbins)
            and all(info.file_size == 0 for info in init_jbins)
        )
    return {
        'resource_path': resource['resource_path'],
        'resource_offset': resource['resource_offset'],
        'resource_size': resource['resource_size'],
        'zip_offset': resource['zip_offset'],
        'zip_entries': len(infos),
        'init_jbin_count': len(init_jbins),
        'injected_js_count': injected_count,
        'zip_error': bad_file,
        'patched': patched,
    }


def patch_exe(src_exe, out_exe, js_dir, init_path=None, toolkit_dir=None):
    src_exe = os.path.abspath(src_exe)
    out_exe = os.path.abspath(out_exe)
    if os.path.normcase(src_exe) == os.path.normcase(out_exe):
        raise ValueError('输出 EXE 不能与源 EXE 相同')
    os.makedirs(os.path.dirname(out_exe), exist_ok=True)
    temporary_output = out_exe + '.tmp'
    try:
        shutil.copy2(src_exe, temporary_output)
        source_sha256 = sha256_file(temporary_output)
        source_inspection = inspect_exe(temporary_output)
        resource = find_embedded_resource(temporary_output)
        header = resource['decrypted'][:resource['zip_offset']]
        zip_bytes = resource['decrypted'][resource['zip_offset']:]
        injected, replacements = collect_js_files(js_dir, init_path, toolkit_dir)
        final_zip, stats = rebuild_same_size_zip(zip_bytes, injected)
        new_decrypted = header + final_zip
        if len(new_decrypted) != resource['resource_size']:
            raise RuntimeError('内嵌资源大小发生变化，已终止写入')
        with open(temporary_output, 'r+b') as stream:
            stream.seek(resource['resource_offset'])
            stream.write(_xor_resource(new_decrypted))
        os.replace(temporary_output, out_exe)
    finally:
        if os.path.exists(temporary_output):
            os.remove(temporary_output)
    verification = inspect_exe(out_exe)
    if not verification['patched']:
        raise RuntimeError('输出 EXE 的注入后校验未通过')
    stats.update(verification)
    stats.update(
        {
            'injected_js': len(injected),
            'toolkit_path_replacements': replacements,
            'source_was_patched': source_inspection['patched'],
            'source_sha256': source_sha256,
            'output_sha256': sha256_file(out_exe),
        }
    )
    return stats
