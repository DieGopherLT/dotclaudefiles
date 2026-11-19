---
name: ansible-migrations
description: Rules for the transitional tasks that carry hosts from one version of an Ansible playbook to the next - data migrations that move what an earlier version left at another path (a data directory, a file, config moved to a new location), and cleanup tasks that remove what an earlier version put on hosts - with their location, ordering, guards, conflict rule, and end of life. Use whenever a playbook or role change relocates data or leaves something behind on hosts that already ran the previous version, even for a single path. Trigger on "migración de datos", "migra los datos", "mueve el directorio", "cambia la ruta de datos", "renombra el directorio", "limpia lo que quedó", "tarea de limpieza", "cleanup del playbook", "borra la tarea de migración", "¿ya puedo borrar la migración?", "¿ya puedo borrar el cleanup?", "data migration", "move the data dir", "remove leftovers".
---

# Ansible migrations

A regular task declares the state a host must end up in. A transitional task exists only because some hosts still hold the state an earlier version of the playbook left behind. Two kinds exist:

- **Migration**: data at an old path must survive at a new one (a data directory moved to `/var/lib/<service>/`, a config file moved to `/etc/<service>/`). It runs **before** the regular tasks that write to the new path.
- **Cleanup**: leftovers to remove (a file, package, unit, user, firewall rule). It follows `references/cleanup-tasks.md`.

A change of owner, mode, or content at the same path is neither: the regular task for that path declares it.

Both kinds keep the playbook declarative: each one checks the host's state, never a record of what already ran. Ansible has no migration ledger, and one in `/etc/ansible/facts.d` would describe what ran instead of what the host holds, would not be written under `--check`, and would assume the files are kept forever. These files are deleted once their job is done.

Before writing either kind, check that the resource belongs to this repo. On a shared host, moving or removing a resource another repo still declares is forbidden, because it breaks that repo's idempotency.

## Where migrations live

```
roles/<role>/tasks/migrations/<YYYY-MM-DD>-<what-moves>.yml
roles/<role>/tasks/main.yml        # imports every migration first
```

Each migration goes in the role that owns the destination: that role's regular tasks are the ones that would otherwise write over it. `main.yml` imports each file explicitly, oldest first, before any regular task:

```yaml
# roles/<role>/tasks/main.yml
- name: Move the data dir to /var/lib
  ansible.builtin.import_tasks: migrations/2026-11-19-data-dir-to-var-lib.yml
  tags: [migrations]

# regular tasks follow
```

When something that runs before the role writes to the destination (an earlier role in the play, a `meta/main.yml` dependency), import the migration in the playbook's `pre_tasks` instead. A standalone playbook keeps `tasks/migrations/` next to it and imports them at the top of its `tasks`, or in `pre_tasks` when it applies roles from `requirements.yml`.

Use `import_tasks`, never `include_tasks` over a fileglob. An import is static, so the `migrations` tag reaches every task inside and `--tags migrations` selects them. An include is dynamic, and its tag would apply only to the include itself.

The order of imports is the order of migrations. When two of them touch the same path, the later one assumes the earlier one already ran.

## What a migration file holds

```yaml
# 2026-11-19: data dir moved from /opt/app/data to /var/lib/app.
# Delete once `--check --tags migrations` reports changed=0 on every production host.
- name: Look for the legacy data dir
  ansible.builtin.stat:
    path: /opt/app/data
  register: app_legacy_data_dir

- name: Move the data dir to /var/lib
  when: app_legacy_data_dir.stat.exists
  block:
    - name: Look at the destination
      ansible.builtin.stat:
        path: /var/lib/app
      register: app_data_dir_target

    - name: List what the destination already holds
      ansible.builtin.find:
        paths: /var/lib/app
        file_type: any
        hidden: true
      register: app_data_dir_contents
      when: app_data_dir_target.stat.isdir | default(false)

    - name: Refuse to merge into existing data
      ansible.builtin.assert:
        that: >-
          not app_data_dir_target.stat.exists
          or (app_data_dir_target.stat.isdir and app_data_dir_contents.matched == 0)
        fail_msg: /var/lib/app already holds data; compare it with /opt/app/data by hand.

    - name: Stop the service before moving its data
      ansible.builtin.systemd_service:
        name: app
        state: stopped

    - name: Move the data dir
      ansible.builtin.command:
        argv: [mv, -T, /opt/app/data, /var/lib/app]
        removes: /opt/app/data
```

- **A dated header comment** says what moved and when the file can be deleted.
- **Literal paths, no role variables.** A migration records a move that already happened. If it read `app_data_dir` and that variable changed later, a migration nobody deleted yet would move the data to a place it was never written for.
- **Self-contained.** It depends on no other task file, handler, or fact except what it registers itself, and inherits only the play's `become`. If it needs a value, it hardcodes it. When the destination's parent may not exist yet (`/srv/<app>/`), create it in the block before the move, with literal `owner`, `group`, and `mode`.
- **Guarded by the old state, not by a marker.** The `stat` of the source decides whether the block runs. When the source is gone, the block is skipped and the file reports `changed=0`.
- **Conflict check before the stop.** The service stops only once the move is known to be safe, so a conflict never leaves it down. `stat`, `find`, and `assert` all run under `--check`, so the dry run reports the conflict before any real run.
- **Two exceptions to the `ansible-conventions` Tasks rules, valid only inside migration files:** `register` + `when` on the source's `stat` is the guard itself, and `command` runs inline. No module moves a path in place, `argv` avoids the shell, and `removes` keeps the task idempotent and lets `--check` report `changed` without running it.

## Conflict: never merge

A migration never writes over a destination that already holds data. The assert stops the run on that host when the destination is a file, or a directory with any entry, hidden ones included, and the data stays in both places, untouched. The check is needed because `mv -T` replaces an existing file without error: it aborts only on a non-empty directory.

The operator resolves it by hand: compare both, keep the right one, and rerun. Never add `--force`, `rsync --delete` or a `rm` of the destination to make the migration pass. A failed migration costs one rerun, but a silent merge destroys data.

This is also why migrations run before regular tasks: a regular task that writes into the destination (a template, an `unarchive`, a service that starts and creates its files) would turn an empty destination into a non-empty one.

When the move crosses filesystems, `mv` copies and then deletes, and a crash in between leaves a partial copy. For large data or a cross-device move, back up the source first, or migrate with a recipe from the `ansible-conventions` skill if one covers the case.

## Running and end of life

Apply a migration with a full run of the playbook, never with a real run limited to `--tags migrations`: the regular service task that starts the service again would not run, and the host would stay down. `--tags migrations` is for `--check` only.

The criterion for deleting it is the host's state, not time. A migration is done when

```sh
ansible-playbook -i inventories/production setup.yml --check --diff --tags migrations
```

reports `changed=0` for it on every production host, with its block skipped. Then delete the file and its import in the same commit. The commit that removes it records that the migration existed and when it was considered finished.

Fresh hosts and reset VMs never held the old state, so the `stat` finds nothing and the block is skipped. They need no `--skip-tags`.

## Verification

1. Run the role on a VM that holds the old state (apply the previous version of the playbook first, or recreate the old paths by hand).
2. `--check --diff --tags migrations` reports `changed` for the migration.
3. A full real run moves the data and leaves the service running, and a second full run reports `changed=0`.
4. Recreate the source with a non-empty destination: `--check` must already fail on the assert, and a real run must fail there too, with the service still running and both paths untouched.

Then audit the change like any other, as the `ansible-conventions` skill describes.

## Cleanup tasks

Removals have their own location, ordering, guards, and end of life: read `references/cleanup-tasks.md` before writing one.
