#!/usr/bin/env python3
"""
File locking helper for pending-issues.json.

Usage:
    from queue_lock import read_queue, write_queue

    q = read_queue('/path/to/bot/pending-issues.json')
    # ... modify q ...
    write_queue('/path/to/bot/pending-issues.json', q)

Both read_queue and write_queue use flock() to prevent concurrent
writes from bot.js, Claude agents, and deploy.sh from clobbering
each other.
"""

import json
import fcntl
import os

def _lock_path(queue_path):
    return queue_path + '.lock'

def read_queue(queue_path):
    """Read pending-issues.json with a shared (read) lock."""
    lock_path = _lock_path(queue_path)
    lock_fd = open(lock_path, 'w')
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_SH)  # shared lock for reading
        with open(queue_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()

def write_queue(queue_path, data):
    """Write pending-issues.json with an exclusive (write) lock."""
    lock_path = _lock_path(queue_path)
    lock_fd = open(lock_path, 'w')
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)  # exclusive lock for writing
        # Write to temp file then rename for atomicity
        tmp_path = queue_path + '.tmp'
        with open(tmp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, queue_path)  # atomic on POSIX
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()

def locked_update(queue_path, update_fn):
    """
    Read-modify-write with exclusive lock held throughout.

    Usage:
        def updater(q):
            for i in q:
                if i['number'] == 42:
                    i['status'] = 'implemented'
            return q

        locked_update('/path/to/pending-issues.json', updater)
    """
    lock_path = _lock_path(queue_path)
    lock_fd = open(lock_path, 'w')
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        with open(queue_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        data = update_fn(data)
        tmp_path = queue_path + '.tmp'
        with open(tmp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, queue_path)
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()
