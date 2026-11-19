# Unix host checklist

What every service deployed with Ansible must satisfy on the host.

## Filesystem (FHS)

- Configuration goes in `/etc/<service>/`, including sensitive config. Owner `root:<service-user>`, directory `0750`, secret files `0640`, so the service can read them but not rewrite them.
- Mutable data goes in `/var/lib/<service>/`, logs that are not in the journal go in `/var/log/<service>/`, cache in `/var/cache/<service>/`. Owned by the service user.
- Locally built binaries go in `/usr/local/bin/`; self-contained third-party trees go in `/opt/<service>/`.
- Every `file`, `template`, and `copy` task sets `owner`, `group`, and `mode` explicitly. Never rely on the remote umask.

## Service users

- Every service runs as its own system user (`ansible.builtin.user` with `system: true`, `shell: /usr/sbin/nologin`), never as root or as the operator's user.
- Create it with a home directory (`create_home: true`), so tools that expect a writable `$HOME` (caches, CLI configs, container runtimes) do not break.
- If it needs elevated commands, grant exactly those commands through sudoers (`community.general.sudoers`, one file per service in `/etc/sudoers.d/`). No `ALL`, and never add the user to the `sudo`/`wheel` group.

## Deploy user

An app deployed from CI gets a dedicated deploy user, and CI's SSH key is authorized with `ansible.posix.authorized_key` (add `ansible.posix` to `requirements.yml`), never with `copy`/`lineinfile` on `authorized_keys`:

1. Generate a fresh ed25519 pair in a temporary directory on the control machine: `ssh-keygen -t ed25519 -N '' -C '<app>-deploy@<ci> <host>' -f <tmp>/<app>-deploy`.
2. Put the public key in the inventory (`host_vars`; it is not a secret) and authorize it for the deploy user.
3. Hand the user the private key's file path so they store it as the CI secret where it belongs (e.g. `DROPLET_SSH_KEY` in the GitHub environment). Never paste the private key into the chat, the repo, or the vault: it would persist in transcripts or history.
4. Once the user confirms the secret is stored, delete the private key from the control machine. CI's secret is the only copy.

Its sudoers file follows the service-user rule above, scoped to its own app: `systemctl restart <app>` and whatever else that deploy needs (e.g. writing `/etc/<app>/image.env`), each with an absolute path and the full argument list. No wildcards in arguments: `systemctl restart *` would let it restart any unit, other apps' included on a shared host.

To rotate, repeat with a new pair and replace both halves; `authorized_key` with `state: absent` removes the old public key.

## systemd

- Every long-running process is a systemd unit rendered from a template, containers included: the unit owns the container's lifecycle, restart policy, and ordering against its dependencies.
- The unit sets `User=`/`Group=` to the service user and `Restart=` explicitly.
- Manage it with `ansible.builtin.systemd_service` (`daemon_reload: true`, `enabled: true`), restarting through a handler notified by the template task.

## Vault

- Vault password files live in `~/.ansible/<name>.pass` on the control machine, mode `0600`, outside the repo. Reference them with `vault_password_file` in `ansible.cfg` or `--vault-password-file`; never commit one.
