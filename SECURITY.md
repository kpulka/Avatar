# Security policy

## Supported versions and scope

Security reports are welcome for the v1.x client application and this repository.
The ElevenLabs agent configuration is managed outside this repository and is outside
its scope.

## Reporting a vulnerability

Please use GitHub private vulnerability reporting for this repository's security
issues. Include the affected version, impact, and enough detail for the maintainer to
investigate. Do not disclose credentials or sensitive details in a public issue.
Use the same private channel to report abuse of a public agent or its quota.

## Credentials and public agents

An ElevenLabs public agent ID is public by design. It can be supplied in Settings or
through `?agent_id=`; it is not an API credential. An exposed agent can nevertheless
consume usage quota. The owner should restrict allowed domains and usage quotas in
the ElevenLabs dashboard.

API keys must never be stored in this repository or shipped to the client. Keep them
server-side and use a server-generated signed URL when authenticated access is
required. Never commit environment files, private keys, or credentials.

## Embedding

The current embed bridge accepts configured parent origins and currently also uses
the document referrer. It supports `avatar:set_agent` and `?allow_any_origin=1`;
the latter is not limited to development builds yet. Do not treat the current bridge
as providing the hardened parent-window boundary described below.

Planned hardening in 11.1-01 will accept inbound messages only from the direct parent
of a framed widget, use `?parent_origin=` as the origin allowlist (same-origin when
empty), remove remote agent changes, and make `?allow_any_origin=1` development-only.
After that change, agent selection is intended to follow `?agent_id=`, Settings,
then the default. These protections remain pending verification.
